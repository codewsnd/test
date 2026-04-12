interface IOption {
  value: string;
  label: string;
  sortOrder: number;
}

interface ISelectOption {
  id: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  name: string;
  module: string;
  options: Option[];
}

export type SelectOption = Partial<ISelectOption>;
export type Option = Partial<IOption>;
