import { TempoEntry, IPivotNode } from '../types/tempo';

export function aggregatePivotData(entries: TempoEntry[]): IPivotNode[] {
  if (!entries || entries.length === 0) return [];

  const rootMap = new Map<string, any>();

  const getOrSet = (
    map: Map<string, any>,
    key: string,
    title: string,
    level: IPivotNode['level'],
    dims: {
      yearVal?: string;
      monthVal?: string;
      budgetLineVal?: string;
      categoryVal?: string;
      lotVal?: string;
      featureIdVal?: string;
      entryTaskVal?: string;
    }
  ) => {
    let node = map.get(key);
    if (!node) {
      node = {
        key,
        level,
        title,
        yearVal: dims.yearVal || '',
        monthVal: dims.monthVal || '',
        budgetLineVal: dims.budgetLineVal || '',
        categoryVal: dims.categoryVal || '',
        lotVal: dims.lotVal || '',
        featureIdVal: dims.featureIdVal || '',
        entryTaskVal: dims.entryTaskVal || '',
        intDays: 0,
        extDays: 0,
        totalDays: 0,
        childrenMap: new Map<string, any>()
      };
      map.set(key, node);
    }
    return node;
  };

  for (const entry of entries) {
    const days = entry.timeInDays || 0;
    const isInt = entry.type === 'INT';
    const isExt = entry.type === 'EXT';

    const yearVal = String(entry.year || '2026');
    const yearNode = getOrSet(rootMap, yearVal, `Total pour ${yearVal}`, 'year', { yearVal });
    yearNode.totalDays += days;
    if (isInt) yearNode.intDays += days;
    if (isExt) yearNode.extDays += days;

    const monthNum = entry.month || 1;
    const monthVal = String(monthNum);
    const monthKey = `${yearVal}-${String(monthNum).padStart(2, '0')}`;
    const monthNode = getOrSet(yearNode.childrenMap, monthKey, `Total pour ${monthVal}`, 'month', {
      yearVal,
      monthVal
    });
    monthNode.totalDays += days;
    if (isInt) monthNode.intDays += days;
    if (isExt) monthNode.extDays += days;

    const budgetLineVal = entry.budgetLine && entry.budgetLine !== 'NC' ? entry.budgetLine : '[Sans Ligne Budget]';
    const budgetKey = `${monthKey}_${budgetLineVal}`;
    const budgetNode = getOrSet(monthNode.childrenMap, budgetKey, `Total pour ${budgetLineVal}`, 'budgetLine', {
      yearVal,
      monthVal,
      budgetLineVal
    });
    budgetNode.totalDays += days;
    if (isInt) budgetNode.intDays += days;
    if (isExt) budgetNode.extDays += days;

    const categoryVal = entry.category && entry.category !== 'NC' ? entry.category : 'Projet';
    const catKey = `${budgetKey}_${categoryVal}`;
    const catNode = getOrSet(budgetNode.childrenMap, catKey, categoryVal, 'category', {
      yearVal,
      monthVal,
      budgetLineVal,
      categoryVal
    });
    catNode.totalDays += days;
    if (isInt) catNode.intDays += days;
    if (isExt) catNode.extDays += days;

    const lotVal = entry.lot && entry.lot !== 'NC' ? entry.lot : '';
    const lotKey = `${catKey}_${lotVal}`;
    const lotNode = getOrSet(catNode.childrenMap, lotKey, `Total pour ${lotVal}`, 'lot', {
      yearVal,
      monthVal,
      budgetLineVal,
      categoryVal,
      lotVal
    });
    lotNode.totalDays += days;
    if (isInt) lotNode.intDays += days;
    if (isExt) lotNode.extDays += days;

    // FeatureId defaults to "-100" if unattached
    const rawFeat = entry.featureId ? String(entry.featureId).trim() : '';
    const featureIdVal = rawFeat && rawFeat !== 'NC' ? rawFeat : '-100';
    const featKey = `${lotKey}_${featureIdVal}`;
    const featNode = getOrSet(lotNode.childrenMap, featKey, featureIdVal, 'featureId', {
      yearVal,
      monthVal,
      budgetLineVal,
      categoryVal,
      lotVal,
      featureIdVal
    });
    featNode.totalDays += days;
    if (isInt) featNode.intDays += days;
    if (isExt) featNode.extDays += days;

    const entryTaskVal = entry.entryTask || entry.issueKey;
    const taskKey = `${featKey}_${entry.issueKey}`;
    const taskNode = getOrSet(featNode.childrenMap, taskKey, entryTaskVal, 'entryTask', {
      yearVal,
      monthVal,
      budgetLineVal,
      categoryVal,
      lotVal,
      featureIdVal,
      entryTaskVal
    });
    if (entry.ticketLink) {
      taskNode.ticketLinkVal = entry.ticketLink;
    }
    taskNode.totalDays += days;
    if (isInt) taskNode.intDays += days;
    if (isExt) taskNode.extDays += days;
  }

  const formatNode = (node: any): IPivotNode => {
    const childrenArray: any[] = Array.from(node.childrenMap.values());
    const formattedChildren = childrenArray.map(formatNode);

    return {
      key: node.key,
      level: node.level,
      title: node.title,
      yearVal: node.yearVal,
      monthVal: node.monthVal,
      budgetLineVal: node.budgetLineVal,
      categoryVal: node.categoryVal,
      lotVal: node.lotVal,
      featureIdVal: node.featureIdVal,
      entryTaskVal: node.entryTaskVal,
      ticketLinkVal: node.ticketLinkVal,
      intDays: Number(node.intDays.toFixed(2)),
      extDays: Number(node.extDays.toFixed(2)),
      totalDays: Number(node.totalDays.toFixed(2)),
      children: formattedChildren.length > 0 ? formattedChildren : undefined
    };
  };

  return Array.from(rootMap.values()).map(formatNode);
}
