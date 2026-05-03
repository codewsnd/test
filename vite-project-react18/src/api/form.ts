import { springboot2Api } from './axios';
import type {Form} from "../models/form";
import type {Page} from '../models/page';
import {buildQueryParams} from "../utils/paramUtils";

export const listFormApi = async (Form?: Form): Promise<Array<Form>> => {
  try {
    const queryString = buildQueryParams({
      ...Form
    });
    return await springboot2Api.get(`/forms?${queryString}`);
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
    return await springboot2Api.get(`/forms/page?${queryString}`);
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}

export const saveFormApi = async (Form: Form): Promise<Form> => {
  try {
    let response;
    if (Form.id) {
      response = await springboot2Api.put(`/forms/${Form.id}`, Form);
    } else {
      response = await springboot2Api.post(`/forms`, Form);
    }
    return response;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}


export const deleteFormApi = async (Form: Form): Promise<Form> => {
  try {
    const response = await springboot2Api.delete(`/forms/${Form.id}`);
    return response;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}


export const getFormApi = async (id: string): Promise<Form> => {
  try {
    const response = await springboot2Api.get(`/forms/${id}`);
    return response;
  } catch (error) {
    console.error('API Error', error);
    throw error;
  }
}
