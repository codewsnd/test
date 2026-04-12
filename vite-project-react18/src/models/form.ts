interface IForm {
  id: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  name: string;
  module: string;
  title: string;
  description: string;
  formConfig: object;
}

export type Form = Partial<IForm>;
