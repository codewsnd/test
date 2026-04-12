package com.demo.service;

import com.demo.context.StaffIdThreadLocal;
import com.demo.model.FormResponse;
import com.demo.repository.FormResponseRepository;
import com.demo.utils.BQABeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
public class FormResponseService {

    @Autowired
    private FormResponseRepository formResponseRepository;

    public FormResponse createFormResponse(FormResponse formResponse) {
        formResponse.setId(null);
        return formResponseRepository.save(formResponse);
    }

    public FormResponse getFormResponse(String id) {
        return formResponseRepository.findById(id).orElseThrow(() -> new RuntimeException("FormResponse not found"));
    }

    public FormResponse getMyFormResponse(String FormId) {
        return formResponseRepository.findByFormIdAndCreatedBy(FormId, StaffIdThreadLocal.getStaffId())
                .orElse(null);
    }

    public Page<FormResponse> pageFormResponse(Pageable pageable, FormResponse formResponse) {
        return formResponseRepository.findAll(pageable);
    }

    public FormResponse updateFormResponse(String id, FormResponse formResponse) {
        FormResponse oldFormResponse = getFormResponse(id);
        BQABeanUtils.copyProperties(formResponse, oldFormResponse);
        return formResponseRepository.save(oldFormResponse);
    }

    public void deleteFormResponse(String id) {
        formResponseRepository.deleteById(id);
    }
}
