package com.mytest.backend.agent.controller;

import com.mytest.backend.agent.dto.AgentSaveRequest;
import com.mytest.backend.agent.service.AgentService;
import com.mytest.backend.agent.vo.AgentResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/agents")
@RequiredArgsConstructor
@Validated
@CrossOrigin(origins = "*")
public class AgentController {

    private final AgentService agentService;

    @GetMapping
    public List<AgentResponse> listAgents(
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String type) {
        return agentService.listAgents(name, type);
    }

    @GetMapping("/{id}")
    public AgentResponse getAgent(@PathVariable @NotNull Long id) {
        return agentService.getAgent(id);
    }

    @PostMapping
    public AgentResponse createAgent(@Valid @RequestBody AgentSaveRequest request) {
        return agentService.createAgent(request);
    }

    @PutMapping("/{id}")
    public AgentResponse updateAgent(
            @PathVariable @NotNull Long id,
            @Valid @RequestBody AgentSaveRequest request) {
        return agentService.updateAgent(id, request);
    }

    @DeleteMapping("/{id}")
    public void deleteAgent(@PathVariable @NotNull Long id) {
        agentService.deleteAgent(id);
    }
}
