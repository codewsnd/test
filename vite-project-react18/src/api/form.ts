import api from './axios';
import type {Form} from "../models/form";
import type {Page} from '../models/page';
import {buildQueryParams} from "../utils/paramUtils";

export const listFormApi = async (Form?: Form): Promise<Array<Form>> => {
  try {
    const queryString = buildQueryParams({
      ...Form
    });
    return await api.get(`/forms?${queryString}`);
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
    return await api.get(`/forms/page?${queryString}`);
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}

export const saveFormApi = async (Form: Form): Promise<Form> => {
  try {
    let response;
    if (Form.id) {
      response = await api.put(`/forms/${Form.id}`, Form);
    } else {
      response = await api.post(`/forms`, Form);
    }
    return response;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}


export const deleteFormApi = async (Form: Form): Promise<Form> => {
  try {
    const response = await api.delete(`/forms/${Form.id}`);
    return response;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}


export const getFormApi = async (id: string): Promise<Form> => {
  try {
    const response = await api.get(`/forms/${id}`);
    return response;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}
