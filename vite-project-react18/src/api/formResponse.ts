import api from './axios';
import type {FormResponse} from '../models/formResponse';
import {buildQueryParams} from "../utils/paramUtils";
import type {Page} from "../models/page";

export const getMyFormResponseApi = async (formId: string): Promise<FormResponse> => {
  try {
    const response = await api.get(`/forms/responses/${formId}`);
    return response.data;
  } catch (error) {
    return Promise.reject(error);
  }
}

export const pageFormResponseApi = async (page: number, size: number, formResponse: FormResponse): Promise<Page<FormResponse>> => {
  try {
    const queryString = buildQueryParams({
      page: page - 1,
      size,
      ...formResponse
    });
    const response = await api.get(`/forms/responses/page?${queryString}`);
    return response.data;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}


export const saveFormResponseApi = async (formResponse: FormResponse): Promise<FormResponse> => {
  try {
    let response;
    if (formResponse.id) {
      response = await api.put(`/forms/responses/${formResponse.id}`, formResponse);
    } else {
      response = await api.post(`/forms/responses`, formResponse);
    }
    return response.data;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}

export const deleteFormResponseApi = async (formResponseId: string): Promise<FormResponse> => {
  try {
    const response = await api.delete(`/forms/responses/${formResponseId}`);
    return response.data;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}





