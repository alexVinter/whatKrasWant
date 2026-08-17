export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

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
  categories: { id: string; name: string; slug: string }[];
  districts: { id: string; name: string }[];
  features: {
    PUBLIC_CATALOG: boolean;
    PUBLIC_SUBMISSION: boolean;
    VOTING: boolean;
    RESULTS: boolean;
  };
}
