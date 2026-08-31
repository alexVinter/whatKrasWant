export interface PublicIdeaTopic {
  id: string;
  name: string;
  slug: string;
}

export interface PublicSubmissionFormValues {
  topicId: string;
  title: string;
  description: string;
  address: string;
  latitude: string;
  longitude: string;
}

export interface PublicSubmissionResult {
  id: string;
  title: string;
  status: 'MODERATION';
  submittedAt: string;
}

export const EMPTY_PUBLIC_SUBMISSION_FORM: PublicSubmissionFormValues = {
  topicId: '',
  title: '',
  description: '',
  address: '',
  latitude: '',
  longitude: '',
};
