import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { TerritoryType } from '@prisma/client';
import { StatisticsService } from './statistics.service';
import {
  CITYWIDE_TERRITORY_NAME,
  EXCEL_DATE_FORMAT,
  SOURCE_LABELS,
  STATUS_LABELS,
  XLSX_SHEETS,
  yesNo,
} from './statistics.labels';
import type { StatisticsSummary } from './statistics.types';

const INITIATIVE_HEADERS = [
  'Название',
  'Источник',
  'Имя эксперта',
  'Организация',
  'Статус',
  'Тема идеи',
  'Территория',
  'Адрес',
  'Есть геометка',
  'Широта',
  'Долгота',
  'Дата создания',
  'Дата публикации',
];

function exportFilename(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `initiatives_${year}-${month}-${day}.xlsx`;
}

function territoryText(idea: {
  territoryType: TerritoryType;
  districts: { district: { name: string } }[];
}): string {
  if (idea.territoryType === TerritoryType.CITYWIDE) {
    return CITYWIDE_TERRITORY_NAME;
  }
  if (idea.districts.length === 0) {
    return '';
  }
  return idea.districts.map((row) => `${row.district.name} район`).join(', ');
}

function styleHeader(sheet: ExcelJS.Worksheet, columnCount: number): void {
  const row = sheet.getRow(1);
  row.font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columnCount },
  };
}

function setDateCell(cell: ExcelJS.Cell, value: Date | null): void {
  if (!value) {
    cell.value = '';
    return;
  }
  cell.value = value;
  cell.numFmt = EXCEL_DATE_FORMAT;
}

@Injectable()
export class StatisticsXlsxService {
  constructor(private readonly statistics: StatisticsService) {}

  async build(): Promise<{ buffer: Buffer; filename: string }> {
    const [summary, ideas, voteCounts] = await Promise.all([
      this.statistics.getSummary(),
      this.statistics.listIdeasForExport(),
      this.statistics.listVoteCountsForExport(),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Чего хочет Красноярск?';

    this.addInitiativesSheet(workbook, ideas, voteCounts);
    this.addAuthorsSheet(workbook, ideas);
    this.addVotesSheet(workbook, ideas, voteCounts);
    this.addStatisticsSheet(workbook, summary);
    this.addTop20Sheet(workbook);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return { buffer, filename: exportFilename() };
  }

  private addInitiativesSheet(
    workbook: ExcelJS.Workbook,
    ideas: Awaited<ReturnType<StatisticsService['listIdeasForExport']>>,
    voteCounts: Map<string, { total: number; counted: number; excluded: number }>,
  ): void {
    const headers = [
      ...INITIATIVE_HEADERS,
      'Голосов (учитываемых)',
      'Голосов (исключённых)',
    ];
    const sheet = workbook.addWorksheet(XLSX_SHEETS.INITIATIVES);
    sheet.columns = headers.map((header, index) => ({
      header,
      key: `c${index}`,
      width: index === 0 ? 40 : 18,
    }));
    styleHeader(sheet, headers.length);

    for (const idea of ideas) {
      const counts = voteCounts.get(idea.id) ?? {
        total: 0,
        counted: 0,
        excluded: 0,
      };
      const row = sheet.addRow([
        idea.title,
        SOURCE_LABELS[idea.sourceType],
        idea.expertName ?? '',
        idea.expertOrg ?? '',
        STATUS_LABELS[idea.status],
        idea.topic?.name ?? '',
        territoryText(idea),
        idea.address ?? '',
        yesNo(idea.latitude != null && idea.longitude != null),
        idea.latitude ?? '',
        idea.longitude ?? '',
        idea.createdAt,
        idea.publishedAt,
        counts.counted,
        counts.excluded,
      ]);
      setDateCell(row.getCell(12), idea.createdAt);
      setDateCell(row.getCell(13), idea.publishedAt);
    }
  }

  private addAuthorsSheet(
    workbook: ExcelJS.Workbook,
    ideas: Awaited<ReturnType<StatisticsService['listIdeasForExport']>>,
  ): void {
    const headers = [
      'Инициатива',
      'Тип источника',
      'Имя эксперта',
      'Организация',
    ];
    const sheet = workbook.addWorksheet(XLSX_SHEETS.AUTHORS);
    sheet.columns = headers.map((header) => ({ header, width: 28 }));
    styleHeader(sheet, headers.length);

    for (const idea of ideas) {
      sheet.addRow([
        idea.title,
        SOURCE_LABELS[idea.sourceType],
        idea.expertName ?? '',
        idea.expertOrg ?? '',
      ]);
    }
  }

  private addVotesSheet(
    workbook: ExcelJS.Workbook,
    ideas: Awaited<ReturnType<StatisticsService['listIdeasForExport']>>,
    voteCounts: Map<string, { total: number; counted: number; excluded: number }>,
  ): void {
    const headers = [
      'Инициатива',
      'Статус',
      'Всего голосов',
      'Учитываемых',
      'Исключённых',
    ];
    const sheet = workbook.addWorksheet(XLSX_SHEETS.VOTES);
    sheet.columns = headers.map((header) => ({ header, width: 28 }));
    styleHeader(sheet, headers.length);

    for (const idea of ideas) {
      const counts = voteCounts.get(idea.id) ?? {
        total: 0,
        counted: 0,
        excluded: 0,
      };
      sheet.addRow([
        idea.title,
        STATUS_LABELS[idea.status],
        counts.total,
        counts.counted,
        counts.excluded,
      ]);
    }
  }

  private addStatisticsSheet(
    workbook: ExcelJS.Workbook,
    summary: StatisticsSummary,
  ): void {
    const sheet = workbook.addWorksheet(XLSX_SHEETS.STATISTICS);
    sheet.columns = [
      { header: 'Показатель', width: 36 },
      { header: 'Значение', width: 28 },
    ];
    styleHeader(sheet, 2);

    const rows: [string, string | number][] = [
      ['Экспертные инициативы', summary.expertInitiatives],
      ['Черновики', summary.draft],
      ['Опубликованные', summary.published],
      ['Архив', summary.archived],
      ['С геометкой', summary.withLocation],
    ];
    for (const item of summary.byStatus) {
      rows.push([`Статус: ${item.label}`, item.count]);
    }
    for (const item of summary.bySource) {
      rows.push([`Источник: ${item.label}`, item.count]);
    }
    for (const item of summary.byTerritory) {
      rows.push([`Территория: ${item.name}`, item.count]);
    }
    for (const [label, value] of rows) {
      sheet.addRow([label, value]);
    }
  }

  private addTop20Sheet(workbook: ExcelJS.Workbook): void {
    const sheet = workbook.addWorksheet(XLSX_SHEETS.TOP20);
    sheet.columns = [{ header: 'Информация', width: 64 }];
    styleHeader(sheet, 1);
    sheet.addRow(['Данные топ-20 появятся на соответствующем этапе.']);
  }
}
