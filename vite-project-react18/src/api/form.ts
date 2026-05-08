import axios from './axios';
import type {Form} from "../models/form";
import type {Page} from '../models/page';
import {buildQueryParams} from "../utils/paramUtils";

const SPRINGBOOT2_API_URL = import.meta.env.VITE_API_SPRINGBOOT2_URL || 'http://localhost:8082';

export const listFormApi = async (Form?: Form): Promise<Array<Form>> => {
  try {
    const queryString = buildQueryParams({
      ...Form
    });
    const response = await axios.get<Array<Form>>(`${SPRINGBOOT2_API_URL}/forms?${queryString}`);
    return response.data;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}

export const pageFormApi = async (page: number, size: number = 10, Form?: Form): Promise<Page<Form>> => {
  try {
    const queryString = buildQueryParams({
      page: page - 1,
      size,
      ...Form
    });
    const response = await axios.get<Page<Form>>(`${SPRINGBOOT2_API_URL}/forms/page?${queryString}`);
    return response.data;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}

export const saveFormApi = async (Form: Form): Promise<Form> => {
  try {
    let response;
    if (Form.id) {
      response = await axios.put<Form>(`${SPRINGBOOT2_API_URL}/forms/${Form.id}`, Form);
    } else {
      response = await axios.post<Form>(`${SPRINGBOOT2_API_URL}/forms`, Form);
    }
    return response.data;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}


export const deleteFormApi = async (Form: Form): Promise<Form> => {
  try {
    const response = await axios.delete<Form>(`${SPRINGBOOT2_API_URL}/forms/${Form.id}`);
    return response.data;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}


export const getFormApi = async (id: string): Promise<Form> => {
  try {
    const response = await axios.get<Form>(`${SPRINGBOOT2_API_URL}/forms/${id}`);
    return response.data;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}
