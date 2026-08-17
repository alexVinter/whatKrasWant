export interface NamedCount {
  id: string;
  name: string;
  count: number;
}

export interface StatusCount {
  status: string;
  label: string;
  count: number;
}

export interface SourceCount {
  sourceType: string;
  label: string;
  count: number;
}

export interface AdminStatistics {
  expertInitiatives: number;
  draft: number;
  published: number;
  archived: number;
  withLocation: number;
  uncategorized: number;
  byStatus: StatusCount[];
  bySource: SourceCount[];
  byCategory: NamedCount[];
  byTerritory: NamedCount[];
}
