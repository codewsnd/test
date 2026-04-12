package com.demo.controller;

import com.demo.model.Prompt;
import com.demo.service.PromptService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/prompts")
public class PromptController {

    @Autowired
    private PromptService promptService;

    @PostMapping
    public Prompt createPrompt(@RequestBody Prompt prompt) {
        return promptService.createPrompt(prompt);
    }

    @GetMapping("/{id}")
    public Prompt getPrompt(@PathVariable String id) {
        return promptService.getPrompt(id);
    }

    @GetMapping("/page")
    public Page<Prompt> pagePrompt(@PageableDefault Pageable pageable, Prompt prompt) {
        return promptService.pagePrompt(pageable, prompt);
    }

    @PutMapping("/{id}")
    public Prompt updatePrompt(@PathVariable String id, @RequestBody Prompt prompt) {
        return promptService.updatePrompt(id, prompt);
    }

    @DeleteMapping("/{id}")
    public void deletePrompt(@PathVariable String id) {
        promptService.deletePrompt(id);
    }

    @PostMapping("/{id}/like")
    public void likePrompt(@PathVariable String id) {
        promptService.likePrompt(id);
    }

    @PostMapping("/{id}/unlike")
    public void unlikePrompt(@PathVariable String id) {
        promptService.unlikePrompt(id);
    }
}
