package com.demo.controller;

import com.demo.model.SelectOption;
import com.demo.service.SelectOptionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/selectOptions")
public class SelectOptionController {

    @Autowired
    private SelectOptionService selectOptionService;

    @PostMapping
    public SelectOption create(@RequestBody SelectOption option) {
        return selectOptionService.create(option);
    }

    @GetMapping("/{id}")
    public SelectOption getById(@PathVariable String id) {
        return selectOptionService.getById(id);
    }

    @GetMapping
    public List<SelectOption> listSelectOption(SelectOption selectOption) {
        return selectOptionService.listSelectOption(selectOption);
    }

    @PutMapping("/{id}")
    public SelectOption update(@PathVariable String id, @RequestBody SelectOption option) {
        return selectOptionService.update(id, option);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable String id) {
        selectOptionService.delete(id);
    }

    @PostMapping("/{id}/options")
    public SelectOption addOption(@PathVariable String id, @RequestBody SelectOption.Option option) {
        return selectOptionService.addOption(id, option);
    }

    @DeleteMapping("/{id}/options/{index}")
    public SelectOption deleteOption(@PathVariable String id, @PathVariable int index) {
        return selectOptionService.deleteOption(id, index);
    }

    @PutMapping("/{id}/options/{index}")
    public SelectOption updateOption(@PathVariable String id, @PathVariable int index,
                                     @RequestBody SelectOption.Option option) {
        return selectOptionService.updateOption(id, index, option);
    }

    @PostMapping("/{id}/options/move")
    public SelectOption moveOption(@PathVariable String id,
                                   @RequestParam int fromIndex,
                                   @RequestParam int toIndex) {
        return selectOptionService.moveOption(id, fromIndex, toIndex);
    }
}
