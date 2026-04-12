package com.demo.service;

import com.demo.model.Form;
import com.demo.model.Prompt;
import com.demo.repository.FormRepository;
import com.demo.utils.BQABeanUtils;
import com.demo.utils.BQAQueryUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class FormService {

    @Autowired
    private FormRepository formRepository;
    @Autowired
    private MongoTemplate mongoTemplate;

    public Form createForm(Form form) {
        form.setId(null);
        return formRepository.save(form);
    }

    public Form getForm(String id) {
        return formRepository.findById(id).orElseThrow(() -> new RuntimeException("Form not found"));
    }

    public Page<Form> pageForm(Pageable pageable, Form form) {
        return formRepository.findAll(pageable);
    }

    public Form updateForm(String id, Form form) {
        Form oldForm = getForm(id);
        BQABeanUtils.copyProperties(form, oldForm);
        return formRepository.save(oldForm);
    }

    public void deleteForm(String id) {
        formRepository.deleteById(id);
    }

    public List<Form> listForm(Form form) {
        BQAQueryUtils.buildQuery(form);
        return mongoTemplate.find(BQAQueryUtils.buildQuery(form), Form.class);
    }
}
