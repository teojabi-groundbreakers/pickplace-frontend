#!/usr/bin/env python3
"""Compare an official address-code ZIP with a versioned FE reference snapshot.

This read-only check uses the XLSX files in the supplied ZIP; it does not download,
extract, or modify either input. The snapshot and official data remain independent.
"""

import argparse
import hashlib
import io
import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path
from zipfile import BadZipFile, ZipFile


NAMESPACE = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
CODE = re.compile(r'\d{10}\Z')
CELL_COLUMN = re.compile(r'([A-Z]+)\d+\Z')
HEADERS = {
  'H': ['행정동코드', '시도명', '시군구명', '읍면동명', '생성일자', '말소일자'],
  'mix': [
    '행정동코드',
    '시도명',
    '시군구명',
    '읍면동명',
    '법정동코드',
    '동리명',
    '생성일자',
    '말소일자',
  ],
}


def xlsx_rows(data):
  with ZipFile(io.BytesIO(data)) as workbook:
    strings_xml = ET.fromstring(workbook.read('xl/sharedStrings.xml'))
    strings = [
      ''.join(node.text or '' for node in entry.findall('.//x:t', NAMESPACE))
      for entry in strings_xml.findall('x:si', NAMESPACE)
    ]
    sheet = ET.fromstring(workbook.read('xl/worksheets/sheet1.xml'))
    rows = []
    for row in sheet.findall('.//x:sheetData/x:row', NAMESPACE):
      cells = {}
      for cell in row.findall('x:c', NAMESPACE):
        match = CELL_COLUMN.fullmatch(cell.get('r', ''))
        if not match or match.group(1) in cells:
          raise ValueError('잘못되었거나 중복된 XLSX 셀 주소')
        value_node = cell.find('x:v', NAMESPACE)
        value = value_node.text if value_node is not None and value_node.text else ''
        if cell.get('t') == 's' and value:
          value = strings[int(value)]
        elif cell.get('t') not in (None, 'n') and value:
          raise ValueError('지원하지 않는 XLSX 셀 형식')
        cells[match.group(1)] = value.strip()
      rows.append(cells)
    return rows


def load_sheet(archive, kind):
  pattern = re.compile(rf'(?:^|/)KIK(?:cd_H|mix)\.\d{{8}}\.xlsx\Z', re.IGNORECASE)
  prefix = 'kikcd_h.' if kind == 'H' else 'kikmix.'
  matches = [
    name
    for name in archive.namelist()
    if pattern.search(name) and name.rsplit('/', 1)[-1].lower().startswith(prefix)
  ]
  if len(matches) != 1:
    raise ValueError(f'{kind} XLSX 파일이 정확히 하나 필요합니다: {len(matches)}개')
  sheet = xlsx_rows(archive.read(matches[0]))
  if not sheet:
    raise ValueError(f'{kind} XLSX가 비어 있습니다')
  columns = [chr(ord('A') + i) for i in range(len(HEADERS[kind]))]
  if [sheet[0].get(column, '') for column in columns] != HEADERS[kind]:
    raise ValueError(f'{kind} XLSX 헤더가 예상 형식과 다릅니다')

  for index, row in enumerate(sheet[1:], start=2):
    if not CODE.fullmatch(row.get('A', '')):
      raise ValueError(f'{kind} {index}행의 행정동 코드가 10자리 문자열이 아닙니다')
    if kind == 'mix' and not CODE.fullmatch(row.get('E', '')):
      raise ValueError(f'{kind} {index}행의 법정동 코드가 10자리 문자열이 아닙니다')
  return matches[0], sheet[1:]


def inspect(archive_path, snapshot_path):
  digest = hashlib.sha256(archive_path.read_bytes()).hexdigest()
  snapshot = json.loads(snapshot_path.read_text(encoding='utf-8'))
  if (
    not isinstance(snapshot, dict)
    or not isinstance(snapshot.get('dongs'), list)
    or not snapshot['dongs']
    or not isinstance(snapshot.get('districts'), list)
    or not snapshot['districts']
  ):
    raise ValueError('스냅샷의 구 또는 행정동 목록이 없습니다')
  with ZipFile(archive_path) as archive:
    h_name, h_rows = load_sheet(archive, 'H')
    mix_name, mix_rows = load_sheet(archive, 'mix')

  h_date = re.search(r'\.(\d{8})\.xlsx\Z', h_name, re.IGNORECASE)
  mix_date = re.search(r'\.(\d{8})\.xlsx\Z', mix_name, re.IGNORECASE)
  if not h_date or not mix_date or h_date.group(1) != mix_date.group(1):
    raise ValueError('행정동과 관할 자료의 파일 기준일이 다릅니다')

  h_codes = {}
  for row in h_rows:
    code = row['A']
    if code in h_codes:
      raise ValueError(f'행정동 코드가 중복되었습니다: {code}')
    if row.get('F'):
      raise ValueError('현행 자료에 말소일이 포함되어 있습니다. 입력 자료를 확인하세요')
    h_codes[code] = row

  districts = {}
  for district in snapshot['districts']:
    if (
      not isinstance(district, dict)
      or not isinstance(district.get('code'), str)
      or not district['code']
      or not isinstance(district.get('name'), str)
      or not district['name']
      or district['code'] in districts
    ):
      raise ValueError('스냅샷의 구 코드 또는 이름이 올바르지 않습니다')
    districts[district['code']] = district['name']

  matches = Counter()
  mismatches = []
  source_codes = set()
  official_codes = set()
  for dong in snapshot['dongs']:
    if not isinstance(dong, dict) or dong.get('status') not in ('CURRENT', 'LEGACY'):
      raise ValueError('스냅샷의 행정동 상태가 올바르지 않습니다')
    code = dong.get('officialCode')
    name = dong.get('officialName')
    source_code = dong.get('code')
    district_name = districts.get(dong.get('districtCode'))
    if (
      not isinstance(source_code, str)
      or not source_code
      or source_code in source_codes
      or not isinstance(code, str)
      or not CODE.fullmatch(code)
      or code in official_codes
      or not isinstance(name, str)
      or not name
      or not district_name
    ):
      raise ValueError('스냅샷의 공식 코드·이름 또는 구 소속이 올바르지 않습니다')
    source_codes.add(source_code)
    official_codes.add(code)
    if dong['status'] == 'LEGACY':
      matches['legacy'] += 1
      continue
    official = h_codes.get(code)
    if (
      official
      and official.get('B') == '서울특별시'
      and official.get('C') == district_name
      and official.get('D') == name
    ):
      matches['matched'] += 1
    else:
      matches['mismatched'] += 1
      observed = (
        f'{official.get("B", "")} {official.get("C", "")} {official.get("D", "")}'
        if official
        else '코드 없음'
      )
      mismatches.append(f'{code} 서울특별시 {district_name} {name}: {observed}')

  legal_to_administrative = defaultdict(set)
  administrative_to_legal = defaultdict(set)
  for row in mix_rows:
    if row.get('H'):
      raise ValueError('현행 관할 자료에 말소일이 포함되어 있습니다')
    if row['A'] not in h_codes:
      raise ValueError(f'관할 자료의 행정동이 H 목록에 없습니다: {row["A"]}')
    if row.get('D'):
      legal_to_administrative[row['E']].add(row['A'])
      administrative_to_legal[row['A']].add(row['E'])

  print(f'원본 ZIP: {archive_path}')
  print(f'원본 SHA-256: {digest}')
  print(f'원본 파일 기준일: {h_date.group(1)}')
  print(f'행정동 파일: {h_name} ({len(h_rows)}행, 상위 기관 포함)')
  print(f'관할 파일: {mix_name} ({len(mix_rows)}행, 상위 기관 포함)')
  print(f'읍·면·동 명칭이 있는 행정기관: {sum(bool(row.get("D")) for row in h_rows)}개')
  print(f'스냅샷 기준 버전: {snapshot.get("version", "확인 불가")}')
  print(f'현행 코드·이름 일치: {matches["matched"]}개, 불일치: {matches["mismatched"]}개')
  print(f'과거 코드 별도: {matches["legacy"]}개 (현행 코드 일치 판정에서 제외)')
  print(f'복수 행정동에 대응하는 법정동 코드: {sum(len(v) > 1 for v in legal_to_administrative.values())}개')
  print(f'복수 법정동에 대응하는 행정동 코드: {sum(len(v) > 1 for v in administrative_to_legal.values())}개')
  for mismatch in mismatches:
    print(f'불일치: {mismatch}')
  return bool(mismatches)


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument('--archive', required=True, type=Path, help='행정안전부 현행 코드 ZIP 경로')
  parser.add_argument('--snapshot', required=True, type=Path, help='비교할 FE 기준정보 JSON 경로')
  args = parser.parse_args()
  try:
    return int(inspect(args.archive, args.snapshot))
  except (BadZipFile, ET.ParseError, IndexError, KeyError, OSError, TypeError, ValueError) as error:
    print(f'검증 실패: {error}', file=sys.stderr)
    return 2


if __name__ == '__main__':
  sys.exit(main())
