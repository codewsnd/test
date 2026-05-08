import axios from './axios';
import type {FormResponse} from '../models/formResponse';
import {buildQueryParams} from "../utils/paramUtils";
import type {Page} from "../models/page";

const SPRINGBOOT2_API_URL = import.meta.env.VITE_API_SPRINGBOOT2_URL || 'http://localhost:8082';

export const getMyFormResponseApi = async (formId: string): Promise<FormResponse> => {
  try {
    const response = await axios.get<FormResponse>(`${SPRINGBOOT2_API_URL}/forms/responses/${formId}`);
    return response;
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
    const response = await axios.get<Page<FormResponse>>(`${SPRINGBOOT2_API_URL}/forms/responses/page?${queryString}`);
    return response;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}


export const saveFormResponseApi = async (formResponse: FormResponse): Promise<FormResponse> => {
  try {
    let response;
    if (formResponse.id) {
      response = await axios.put<FormResponse>(`${SPRINGBOOT2_API_URL}/forms/responses/${formResponse.id}`, formResponse);
    } else {
      response = await axios.post<FormResponse>(`${SPRINGBOOT2_API_URL}/forms/responses`, formResponse);
    }
    return response;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}

export const deleteFormResponseApi = async (formResponseId: string): Promise<FormResponse> => {
  try {
    const response = await axios.delete<FormResponse>(`${SPRINGBOOT2_API_URL}/forms/responses/${formResponseId}`);
    return response;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}


