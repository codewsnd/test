interface IFormResponse {
  id: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  response: object;
  formId: string;
}

export type FormResponse = Partial<IFormResponse>;
