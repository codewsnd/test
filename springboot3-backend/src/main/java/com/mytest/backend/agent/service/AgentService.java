package com.mytest.backend.agent.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.mytest.backend.agent.dto.AgentSaveRequest;
import com.mytest.backend.agent.entity.ChatAgentInfoDO;
import com.mytest.backend.agent.mapper.ChatAgentInfoMapper;
import com.mytest.backend.agent.vo.AgentResponse;
import com.mytest.backend.exception.CustomException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AgentService {

    private final ChatAgentInfoMapper chatAgentInfoMapper;

    public List<AgentResponse> listAgents(String name, String type) {
        try {
            String normalizedName = normalize(name);
            String normalizedType = normalize(type);
            return chatAgentInfoMapper.selectList(
                            Wrappers.<ChatAgentInfoDO>lambdaQuery()
                                    .like(StringUtils.hasText(normalizedName), ChatAgentInfoDO::getName, normalizedName)
                                    .eq(StringUtils.hasText(normalizedType), ChatAgentInfoDO::getType, normalizedType)
                                    .orderByDesc(ChatAgentInfoDO::getUpdateTime)
                                    .orderByDesc(ChatAgentInfoDO::getCreateTime)
                                    .orderByDesc(ChatAgentInfoDO::getId)
                    ).stream()
                    .map(AgentResponse::from)
                    .toList();
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to list agents", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to list agents");
        }
    }

    public AgentResponse getAgent(Long id) {
        try {
            return AgentResponse.from(requireExistingAgent(id));
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to get agent", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to get agent");
        }
    }

    @Transactional
    public AgentResponse createAgent(AgentSaveRequest request) {
        try {
            Instant now = Instant.now();
            ChatAgentInfoDO entity = ChatAgentInfoDO.builder()
                    .createTime(now)
                    .updateTime(now)
                    .isDeleted(Boolean.FALSE)
                    .build();
            applyRequest(request, entity, false);
            int inserted = chatAgentInfoMapper.insert(entity);
            if (inserted != 1) {
                throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to create agent");
            }
            return AgentResponse.from(entity);
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to create agent", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to create agent");
        }
    }

    @Transactional
    public AgentResponse updateAgent(Long id, AgentSaveRequest request) {
        try {
            ChatAgentInfoDO entity = requireExistingAgent(id);
            applyRequest(request, entity, true);
            int updated = chatAgentInfoMapper.updateById(entity);
            if (updated != 1) {
                throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to update agent");
            }
            return AgentResponse.from(entity);
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to update agent", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to update agent");
        }
    }

    @Transactional
    public void deleteAgent(Long id) {
        try {
            requireExistingAgent(id);
            int deleted = chatAgentInfoMapper.deleteById(id);
            if (deleted != 1) {
                throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to delete agent");
            }
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to delete agent", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to delete agent");
        }
    }

    private ChatAgentInfoDO requireExistingAgent(Long id) {
        ChatAgentInfoDO entity = chatAgentInfoMapper.selectById(id);
        if (entity == null || Boolean.TRUE.equals(entity.getIsDeleted())) {
            throw new CustomException(HttpStatus.NOT_FOUND.value(), "Agent not found");
        }
        return entity;
    }

    private void applyRequest(AgentSaveRequest request, ChatAgentInfoDO entity, boolean keepCreateTime) {
        entity.setName(normalizeRequired(request.getName()));
        entity.setType(normalize(request.getType()));
        entity.setIcon(normalize(request.getIcon()));
        entity.setModelName(normalize(request.getModelName()));
        entity.setSystemPrompt(request.getSystemPrompt());
        entity.setCallCount(request.getCallCount() == null ? 0L : request.getCallCount());
        entity.setTemperature(request.getTemperature());
        entity.setMaxTokens(request.getMaxTokens());
        entity.setTopP(request.getTopP());
        entity.setFrequencyPenalty(request.getFrequencyPenalty());
        entity.setPresencePenalty(request.getPresencePenalty());
        entity.setOutputType(normalize(request.getOutputType()));
        entity.setCreateUser(normalize(request.getCreateUser()));
        entity.setTools(normalize(request.getTools()));
        entity.setTags(normalize(request.getTags()));
        entity.setTemplateSchemas(request.getTemplateSchemas());
        entity.setUpdateTime(Instant.now());
        if (!keepCreateTime && entity.getCreateTime() == null) {
            entity.setCreateTime(Instant.now());
        }
    }

    private String normalize(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private String normalizeRequired(String value) {
        String normalized = normalize(value);
        if (!StringUtils.hasText(normalized)) {
            throw new CustomException(HttpStatus.BAD_REQUEST.value(), "Agent name is required");
        }
        return normalized;
    }
}
