import api from './axios';
import type {Option, SelectOption} from "../models/selectOption";
import {buildQueryParams} from "../utils/paramUtils";

export const listSelectOptionApi = async (params?: SelectOption): Promise<Array<SelectOption>> => {
  try {
    const queryString = buildQueryParams(params);
    const response = await api.get(`/selectOptions?${queryString}`);
    return response.data;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}

export const saveSelectOptionApi = async (option: SelectOption): Promise<SelectOption> => {
  try {
    let response;
    if (option.id) {
      response = await api.put(`/selectOptions/${option.id}`, option);
    } else {
      response = await api.post(`/selectOptions`, option);
    }
    return response.data;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}

export const deleteSelectOptionApi = async (id: string): Promise<void> => {
  try {
    await api.delete(`/selectOptions/${id}`);
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}

export const getSelectOptionApi = async (id: string): Promise<SelectOption> => {
  try {
    const response = await api.get(`/selectOptions/${id}`);
    return response.data;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}


// 添加选项
export const addOptionApi = async (id: string, option: Option): Promise<SelectOption> => {
  try {
    const response = await api.post(`/selectOptions/${id}/options`, option);
    return response.data;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}

// 更新选项
export const updateOptionApi = async (id: string, index: number, option: Option): Promise<SelectOption> => {
  try {
    const response = await api.put(`/selectOptions/${id}/options/${index}`, option);
    return response.data;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}

// 删除选项
export const deleteOptionApi = async (id: string, index: number): Promise<SelectOption> => {
  try {
    const response = await api.delete(`/selectOptions/${id}/options/${index}`);
    return response.data;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}

// 移动选项位置
export const moveOptionApi = async (id: string, fromIndex: number, toIndex: number): Promise<SelectOption> => {
  try {
    const response = await api.post(`/selectOptions/${id}/options/move`, null, {
      params: {fromIndex, toIndex}
    });
    return response.data;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}
