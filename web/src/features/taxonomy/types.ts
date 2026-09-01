export interface AdminDistrict {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaxonomyInput {
  name: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface PublicConfig {
  districts: { id: string; name: string }[];
  features: {
    PUBLIC_CATALOG: boolean;
    PUBLIC_SUBMISSION: boolean;
    VOTING: boolean;
    RESULTS: boolean;
  };
  collectedIdeasCount: number;
}
