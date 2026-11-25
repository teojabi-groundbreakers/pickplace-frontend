import fontkit from '@pdf-lib/fontkit'
import { PageSizes, PDFDocument, rgb, type PDFPage, type PDFFont, type RGB } from 'pdf-lib'
import type { PdfBadge, PdfDetail, PdfMetric, ReportPdfModel } from './reportPdfModel'

const [pageWidth, pageHeight] = PageSizes.A4
const margin = 36
const pageTop = pageHeight - margin
const pageBottom = 53
const panelWidth = pageWidth - 2 * margin
const panelPadding = 14
const innerX = margin + panelPadding
const innerWidth = panelWidth - 2 * panelPadding
const panelGap = 10
const ink = rgb(0.15, 0.23, 0.19)
const muted = rgb(0.29, 0.34, 0.39)
const accent = rgb(0.125, 0.247, 0.192)
const outline = rgb(0.87, 0.89, 0.91)
const neutralSurface = rgb(0.957, 0.961, 0.965)
const warningInk = rgb(0.47, 0.3, 0.13)
const warningSurface = rgb(0.98, 0.95, 0.9)

type Block = {
  height: number
  draw: (page: PDFPage, top: number) => void
}

function roundedBox(
  page: PDFPage,
  x: number,
  top: number,
  width: number,
  height: number,
  radius: number,
  color?: RGB,
  borderColor?: RGB,
) {
  const right = width - radius
  const bottom = height - radius
  page.drawSvgPath(
    `M ${radius} 0 H ${right} Q ${width} 0 ${width} ${radius} V ${bottom} Q ${width} ${height} ${right} ${height} H ${radius} Q 0 ${height} 0 ${bottom} V ${radius} Q 0 0 ${radius} 0 Z`,
    { x, y: top, color, borderColor, borderWidth: borderColor ? 0.85 : 0 },
  )
}

function wrapText(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.normalize('NFC').split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/)
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate
        continue
      }

      if (line) lines.push(line)
      line = ''
      if (font.widthOfTextAtSize(word, size) <= width) {
        line = word
        continue
      }

      // Long identifiers and words without spaces still stay inside the panel.
      for (const character of word) {
        if (line && font.widthOfTextAtSize(line + character, size) > width) {
          lines.push(line)
          line = ''
        }
        line += character
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

function combine(blocks: Block[]): Block {
  return {
    height: blocks.reduce((sum, block) => sum + block.height, 0),
    draw(page, top) {
      let cursor = top
      for (const block of blocks) {
        block.draw(page, cursor)
        cursor -= block.height
      }
    },
  }
}

function space(height: number): Block {
  return { height, draw: () => undefined }
}

function rule(): Block {
  return {
    height: 8,
    draw(page, top) {
      page.drawLine({
        start: { x: innerX, y: top - 2 },
        end: { x: innerX + innerWidth, y: top - 2 },
        thickness: 0.7,
        color: outline,
      })
    },
  }
}

export async function renderReportPdf(
  model: ReportPdfModel,
  fontBytes: ArrayBuffer,
): Promise<Uint8Array<ArrayBuffer>> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  // Keep original Hangul glyph IDs and prevent substitutions in selectable text.
  const font = await pdf.embedFont(fontBytes, {
    features: { calt: false, kern: false, liga: false, clig: false, rvrn: false },
  })
  pdf.setTitle(model.title)
  pdf.setSubject(`${model.region} · ${model.industry}`)
  pdf.setCreator('PickPlace')
  pdf.setLanguage('ko-KR')

  let page = pdf.addPage(PageSizes.A4)
  let cursor = pageTop

  function newPage() {
    page = pdf.addPage(PageSizes.A4)
    cursor = pageTop
  }

  function drawText(page: PDFPage, text: string, x: number, y: number, size: number, color: RGB) {
    page.drawText(text, { font, x, y, size, color })
  }

  function lineBlocks(
    text: string,
    x = innerX,
    maxWidth = innerWidth,
    size = 10.5,
    lineHeight = 14,
    color = muted,
  ): Block[] {
    return wrapText(text, font, size, maxWidth).map((line) => ({
      height: lineHeight,
      draw(page, top) {
        drawText(page, line, x, top - size, size, color)
      },
    }))
  }

  function badgeWidth(badge: PdfBadge) {
    return font.widthOfTextAtSize(badge.label, 9) + 14
  }

  function drawBadge(page: PDFPage, badge: PdfBadge, x: number, top: number) {
    const background = badge.tone === 'warning' ? warningSurface : neutralSurface
    const color = badge.tone === 'warning' ? warningInk : badge.tone === 'positive' ? accent : muted
    roundedBox(page, x, top, badgeWidth(badge), 17, 4, background)
    drawText(page, badge.label, x + 7, top - 11.5, 9, color)
  }

  function detailBlocks(details: PdfDetail[]): Block[] {
    return details.flatMap(({ text, badge }) => {
      if (!badge) return lineBlocks(text)
      const width = badgeWidth(badge)
      const [first, ...rest] = wrapText(text, font, 10.5, innerWidth - width - 7)
      const firstLine: Block = {
        height: 19,
        draw(page, top) {
          drawBadge(page, badge, innerX, top)
          if (first) drawText(page, first, innerX + width + 7, top - 11.5, 10.5, muted)
        },
      }
      return [firstLine, ...rest.flatMap((line) => lineBlocks(line))]
    })
  }

  function sectionHeading(title: string, status?: PdfBadge): Block {
    const titleWidth = status ? innerWidth - badgeWidth(status) - 12 : innerWidth
    const titleLines = combine(lineBlocks(title, innerX, titleWidth, 14, 20, ink))
    return {
      height: Math.max(titleLines.height, status ? 17 : 0) + 7,
      draw(page, top) {
        titleLines.draw(page, top)
        if (status) drawBadge(page, status, innerX + innerWidth - badgeWidth(status), top)
      },
    }
  }

  function drawPanel(title: string, remaining: Block[], status?: PdfBadge) {
    let start = 0
    let continuation = false
    do {
      const heading = sectionHeading(continuation ? `${title} (계속)` : title, status)
      const overhead = 2 * panelPadding + heading.height
      if (cursor - overhead - (remaining[start]?.height ?? 0) < pageBottom && cursor < pageTop) {
        newPage()
      }

      let height = overhead
      let end = start
      while (end < remaining.length && cursor - height - remaining[end].height >= pageBottom) {
        height += remaining[end].height
        end += 1
      }

      // All content blocks have a bounded height or are split into individual lines.
      if (end === start && start < remaining.length)
        throw new Error('보고서 영역을 배치할 수 없습니다.')
      roundedBox(page, margin, cursor, panelWidth, height, 11, undefined, outline)
      heading.draw(page, cursor - panelPadding)
      combine(remaining.slice(start, end)).draw(page, cursor - panelPadding - heading.height)
      cursor -= height + panelGap
      start = end
      continuation = true
    } while (start < remaining.length)
  }

  function metricHeading(metric: PdfMetric): Block {
    const value = metric.value ?? '제공 불가'
    const size = metric.value === null ? 11.5 : 22
    const valueWidth = Math.min(innerWidth * 0.55, font.widthOfTextAtSize(value, size))
    const valueLines = wrapText(value, font, size, valueWidth + 0.01)
    const titleLines = wrapText(metric.label, font, 12, innerWidth - valueWidth - 12)
    const lastBaseline = Math.max(size, 12)
    return {
      height:
        Math.max(lastBaseline + titleLines.length * 15 - 15, valueLines.length * (size + 4)) + 7,
      draw(page, top) {
        const baseline = top - lastBaseline
        titleLines.forEach((text, i) => drawText(page, text, innerX, baseline - i * 15, 12, ink))
        valueLines.forEach((text, i) => {
          const x = innerX + innerWidth - font.widthOfTextAtSize(text, size)
          drawText(
            page,
            text,
            x,
            baseline - i * (size + 4),
            size,
            metric.value === null ? warningInk : accent,
          )
        })
      },
    }
  }

  function indicatorBlocks(metric: PdfMetric): Block[] {
    const row = [rule(), metricHeading(metric), ...detailBlocks(metric.details), space(6)]
    const group = combine(row)
    if (group.height <= pageTop - pageBottom - 2 * panelPadding - 48) return [group]
    // Keep the row label, value, and first description together if an unusually long row spans pages.
    return [combine(row.slice(0, 3)), ...row.slice(3)]
  }

  function summaryBlocks(metrics: PdfMetric[]): Block[] {
    const gap = 24
    const columnWidth = (innerWidth - gap) / 2
    const rows: Block[] = []
    for (let i = 0; i < metrics.length; i += 2) {
      const columns = metrics.slice(i, i + 2).map((metric, index) => {
        const x = innerX + index * (columnWidth + gap)
        return combine([
          ...lineBlocks(metric.label, x, columnWidth, 11, 17, ink),
          space(3),
          ...lineBlocks(
            metric.value ?? '제공 불가',
            x,
            columnWidth,
            metric.value === null ? 11 : 21,
            27,
            metric.value === null ? warningInk : accent,
          ),
          ...metric.details.flatMap(({ text }) => lineBlocks(text, x, columnWidth)),
        ])
      })
      rows.push({
        height: Math.max(...columns.map((column) => column.height)) + (i ? 8 : 0),
        draw(page, top) {
          columns.forEach((column) => column.draw(page, top - (i ? 8 : 0)))
        },
      })
    }
    return rows
  }

  function scopeHeading(): Block[] {
    const region = model.region.normalize('NFC').replace(/\s+/g, ' ').trim()
    const industry = model.industry.normalize('NFC').replace(/\s+/g, ' ').trim()
    const regionSize = 14
    const industrySize = 11.5
    const regionWidth = font.widthOfTextAtSize(region, regionSize)
    const industryLabel = `·   ${industry}`
    if (regionWidth + 11 + font.widthOfTextAtSize(industryLabel, industrySize) > panelWidth) {
      return [
        ...lineBlocks(region, margin, panelWidth, regionSize, 21, ink),
        ...lineBlocks(industry, margin, panelWidth, industrySize, 17),
      ]
    }

    return [
      {
        height: 21,
        draw(page, top) {
          const baseline = top - regionSize
          drawText(page, region, margin, baseline, regionSize, ink)
          drawText(page, industryLabel, margin + regionWidth + 11, baseline, industrySize, muted)
        },
      },
    ]
  }

  const title = combine([
    ...lineBlocks(model.title, margin, panelWidth, 19, 26, accent),
    space(5),
    ...scopeHeading(),
    ...(model.subtitle ? lineBlocks(model.subtitle, margin, panelWidth, 10, 16) : []),
    space(11),
  ])
  title.draw(page, cursor)
  cursor -= title.height

  for (const section of model.sections) {
    if (section.kind === 'summary') {
      drawPanel(section.title, summaryBlocks(section.metrics))
    } else if (section.kind === 'indicators') {
      drawPanel(
        section.title,
        [
          ...detailBlocks(section.details),
          ...(section.notice
            ? [...lineBlocks(section.notice, innerX, innerWidth, 10.5, 16, warningInk), space(3)]
            : []),
          ...(section.metrics.length
            ? [space(4), ...section.metrics.flatMap(indicatorBlocks)]
            : []),
          ...(section.footnote
            ? [
                ...(section.metrics.length ? [rule()] : []),
                ...lineBlocks(section.footnote, innerX, innerWidth, 9.5, 14),
              ]
            : []),
        ],
        section.status,
      )
    } else {
      drawPanel(section.title, detailBlocks(section.details))
    }
  }

  const pages = pdf.getPages()
  pages.forEach((page, index) => {
    const footer = `${index + 1} / ${pages.length}`
    const footerY = margin - 10
    page.drawLine({
      start: { x: margin, y: footerY + 13 },
      end: { x: pageWidth - margin, y: footerY + 13 },
      thickness: 0.7,
      color: outline,
    })
    drawText(page, 'PickPlace', margin, footerY, 9, muted)
    drawText(
      page,
      footer,
      pageWidth - margin - font.widthOfTextAtSize(footer, 9),
      footerY,
      9,
      muted,
    )
  })

  return new Uint8Array(await pdf.save())
}
