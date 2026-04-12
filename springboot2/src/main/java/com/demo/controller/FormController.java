package com.demo.controller;

import com.demo.model.Form;
import com.demo.service.FormService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/forms")
public class FormController {

    @Autowired
    private FormService formService;

    @PostMapping
    public Form createForm(@RequestBody Form form) {
        return formService.createForm(form);
    }

    @GetMapping("/{id}")
    public Form getForm(@PathVariable String id) {
        return formService.getForm(id);
    }

    @GetMapping
    public List<Form> listForm(Form form) {
        return formService.listForm(form);
    }

    @GetMapping("/page")
    public Page<Form> pageForm(@PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable, Form form) {
        return formService.pageForm(pageable, form);
    }

    @PutMapping("/{id}")
    public Form updateForm(@PathVariable String id, @RequestBody Form form) {
        return formService.updateForm(id, form);
    }

    @DeleteMapping("/{id}")
    public void deleteForm(@PathVariable String id) {
        formService.deleteForm(id);
    }

}
