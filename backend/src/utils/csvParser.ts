export interface CSVParseResult {
  rows: string[][];
  detectedDatesRow: number;
  detectedMatriculeCol: number;
  detectedStartDataRow: number;
  datesCount: number;
  datesPreview: Array<{ colIndex: number; dateStr: string; date: Date }>;
}

/**
 * Parsage robuste de CSV prenant en compte les valeurs entre guillemets et les sauts de ligne.
 */
export function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  // Détection du séparateur principal (, ou ;)
  const firstLine = content.split(/\r?\n/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentCell.trim());
      // Ne pas ajouter de lignes totalement vides
      if (currentRow.some((c) => c !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Tente de parser une chaîne de date au format JJ/MM/AAAA, JJ-MM-AAAA ou AAAA-MM-JJ.
 */
export function parseFrenchDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const cleanStr = dateStr.trim();

  // Format JJ/MM/AAAA ou JJ-MM-AAAA
  const frMatch = cleanStr.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
  if (frMatch) {
    const day = parseInt(frMatch[1], 10);
    const month = parseInt(frMatch[2], 10) - 1;
    const year = parseInt(frMatch[3], 10);
    if (month >= 0 && month < 12 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month, day));
    }
  }

  // Format AAAA-MM-JJ
  const isoMatch = cleanStr.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    if (month >= 0 && month < 12 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month, day));
    }
  }

  return null;
}

/**
 * Analyse la structure CSV pour trouver automatiquement les lignes et colonnes clés.
 */
export function analyzeCSVStructure(rows: string[][]): CSVParseResult {
  let detectedDatesRow = 0;
  let maxDatesFound = 0;
  let datesPreview: Array<{ colIndex: number; dateStr: string; date: Date }> = [];

  // 1. Chercher la ligne qui contient le plus de dates valides
  rows.forEach((row, rowIndex) => {
    let datesInRow = 0;
    const currentDatesPreview: Array<{ colIndex: number; dateStr: string; date: Date }> = [];

    row.forEach((cell, colIndex) => {
      const parsedDate = parseFrenchDate(cell);
      if (parsedDate) {
        datesInRow++;
        currentDatesPreview.push({ colIndex, dateStr: cell, date: parsedDate });
      }
    });

    if (datesInRow > maxDatesFound) {
      maxDatesFound = datesInRow;
      detectedDatesRow = rowIndex;
      datesPreview = currentDatesPreview;
    }
  });

  // 2. Chercher la colonne Matricule
  let detectedMatriculeCol = 0;
  let detectedHeadersRow = -1;

  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const cellLower = row[c].toLowerCase();
      if (cellLower.includes('matricule') || cellLower === 'mat' || cellLower === 'id') {
        detectedMatriculeCol = c;
        detectedHeadersRow = r;
        break;
      }
    }
    if (detectedHeadersRow !== -1) break;
  }

  // 3. Déduire la première ligne de données (startDataRowIndex)
  let detectedStartDataRow = 0;

  if (detectedHeadersRow !== -1) {
    detectedStartDataRow = detectedHeadersRow + 1;
    // Si la ligne juste après les entêtes est une sous-ligne d'entêtes (ex: 1, 2, 3...)
    if (
      detectedStartDataRow < rows.length &&
      rows[detectedStartDataRow][detectedMatriculeCol] === ''
    ) {
      detectedStartDataRow++;
    }
  } else {
    // Si aucun header "Matricule" trouvé, chercher la 1ère ligne avec un matricule probable (ex: BL... ou EX... ou valeur non vide)
    detectedStartDataRow = Math.max(detectedDatesRow + 1, 1);
    for (let r = detectedStartDataRow; r < rows.length; r++) {
      const val = rows[r][detectedMatriculeCol];
      if (val && val.length >= 2 && !val.toLowerCase().includes('date')) {
        detectedStartDataRow = r;
        break;
      }
    }
  }

  return {
    rows,
    detectedDatesRow,
    detectedMatriculeCol,
    detectedStartDataRow,
    datesCount: maxDatesFound,
    datesPreview
  };
}
