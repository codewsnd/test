package com.mytest.backend.conversation.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.mytest.backend.conversation.dto.ConversationCreateRequest;
import com.mytest.backend.conversation.dto.ConversationUpdateStateRequest;
import com.mytest.backend.conversation.entity.ConversationHistory;
import com.mytest.backend.conversation.mapper.ConversationHistoryMapper;
import com.mytest.backend.conversation.vo.ConversationHistoryResponse;
import com.mytest.backend.exception.CustomException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Pageable;
import org.springframework.data.support.PageableExecutionUtils;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationHistoryService {

    private final ConversationHistoryMapper conversationHistoryMapper;

    public org.springframework.data.domain.Page<ConversationHistoryResponse> pageConversations(
            String staffId,
            String search,
            Pageable pageable
    ) {
        try {
            String searchTerm = StringUtils.hasText(search) ? search.trim() : "";
            Page<ConversationHistory> result = conversationHistoryMapper.pageConversations(
                    Page.of(pageable.getPageNumber() + 1L, pageable.getPageSize(), true),
                    staffId,
                    searchTerm
            );
            List<ConversationHistoryResponse> content = result.getRecords().stream()
                    .map(ConversationHistoryResponse::from)
                    .toList();
            return PageableExecutionUtils.getPage(content, pageable, result::getTotal);
        } catch (CustomException e) {
            log.error("[ConversationHistory:Failed] action=page staffId={} page={} size={}", staffId, pageable.getPageNumber(), pageable.getPageSize(), e);
            throw e;
        }
    }

    public ConversationHistoryResponse getConversationDetail(String id, String staffId) {
        try {
            ConversationHistory conversation = requireAccessibleConversation(id, staffId);
            return ConversationHistoryResponse.from(conversation);
        } catch (CustomException e) {
            log.error("[ConversationHistory:Failed] action=detail staffId={} conversationId={}", staffId, id, e);
            throw e;
        }
    }

    @Transactional
    public ConversationHistoryResponse createConversation(String staffId, ConversationCreateRequest request) {
        try {
            ConversationHistory conversation = new ConversationHistory();
            BeanUtils.copyProperties(request, conversation);
            conversation.setId(request.getId());
            conversation.setStaffId(staffId);
            conversation.setIsDeleted(Boolean.FALSE);
            conversationHistoryMapper.insert(conversation);
            log.info("[ConversationHistory] action=create staffId={} conversationId={}", staffId, conversation.getId());
            return ConversationHistoryResponse.from(conversation);
        } catch (CustomException e) {
            log.error("[ConversationHistory:Failed] action=create staffId={} conversationId={}", staffId, request.getId(), e);
            throw e;
        } catch (DuplicateKeyException e) {
            log.error("[ConversationHistory:Failed] action=create staffId={} conversationId={} reason=duplicate", staffId, request.getId(), e);
            throw new CustomException(HttpStatus.CONFLICT.value(), "Conversation already exists");
        }
    }

    @Transactional
    public ConversationHistoryResponse saveConversationState(
            String id,
            String staffId,
            ConversationUpdateStateRequest request
    ) {
        try {
            conversationHistoryMapper.saveConversationState(
                    id,
                    staffId,
                    request.getConversationState(),
                    request.getUpdatedAt()
            );
            ConversationHistory conversation = requireAccessibleConversation(id, staffId);
            log.info("[ConversationHistory] action=saveState staffId={} conversationId={}", staffId, id);
            return ConversationHistoryResponse.from(conversation);
        } catch (CustomException e) {
            log.error("[ConversationHistory:Failed] action=saveState staffId={} conversationId={}", staffId, id, e);
            throw e;
        }
    }

    @Transactional
    public ConversationHistoryResponse renameConversation(String id, String staffId, String newTitle) {
        try {
            conversationHistoryMapper.update(null, Wrappers.<ConversationHistory>lambdaUpdate()
                    .eq(ConversationHistory::getId, id)
                    .eq(ConversationHistory::getStaffId, staffId)
                    .set(ConversationHistory::getTitle, newTitle.trim())
                    .set(ConversationHistory::getTitleGenerating, Boolean.FALSE)
                    .set(ConversationHistory::getUpdatedAt, Instant.now()));
            ConversationHistory conversation = requireAccessibleConversation(id, staffId);
            log.info("[ConversationHistory] action=rename staffId={} conversationId={}", staffId, id);
            return ConversationHistoryResponse.from(conversation);
        } catch (CustomException e) {
            log.error("[ConversationHistory:Failed] action=rename staffId={} conversationId={}", staffId, id, e);
            throw e;
        }
    }

    @Transactional
    public void batchDeleteConversations(List<String> conversationIds, String staffId) {
        try {
            List<String> ids = normalizeIds(conversationIds);
            if (ids.isEmpty()) {
                log.info("[ConversationHistory] action=batchDelete staffId={} count=0 result=skip", staffId);
                return;
            }
            conversationHistoryMapper.update(null, Wrappers.<ConversationHistory>lambdaUpdate()
                    .eq(ConversationHistory::getStaffId, staffId)
                    .in(ConversationHistory::getId, ids)
                    .set(ConversationHistory::getIsDeleted, Boolean.TRUE));
            log.info("[ConversationHistory] action=batchDelete staffId={} count={}", staffId, ids.size());
        } catch (CustomException e) {
            log.error("[ConversationHistory:Failed] action=batchDelete staffId={}", staffId, e);
            throw e;
        }
    }

    @Transactional
    public void batchPinConversations(List<String> conversationIds, String staffId) {
        try {
            List<String> ids = normalizeIds(conversationIds);
            if (ids.isEmpty()) {
                log.info("[ConversationHistory] action=batchPin staffId={} count=0 result=skip", staffId);
                return;
            }
            conversationHistoryMapper.update(null, Wrappers.<ConversationHistory>lambdaUpdate()
                    .eq(ConversationHistory::getStaffId, staffId)
                    .in(ConversationHistory::getId, ids)
                    .set(ConversationHistory::getIsPinned, Boolean.TRUE)
                    .set(ConversationHistory::getPinnedAt, Instant.now()));
            log.info("[ConversationHistory] action=batchPin staffId={} count={}", staffId, ids.size());
        } catch (CustomException e) {
            log.error("[ConversationHistory:Failed] action=batchPin staffId={}", staffId, e);
            throw e;
        }
    }

    @Transactional
    public void batchUnpinConversations(List<String> conversationIds, String staffId) {
        try {
            List<String> ids = normalizeIds(conversationIds);
            if (ids.isEmpty()) {
                log.info("[ConversationHistory] action=batchUnpin staffId={} count=0 result=skip", staffId);
                return;
            }
            conversationHistoryMapper.update(null, Wrappers.<ConversationHistory>lambdaUpdate()
                    .eq(ConversationHistory::getStaffId, staffId)
                    .in(ConversationHistory::getId, ids)
                    .set(ConversationHistory::getIsPinned, Boolean.FALSE)
                    .set(ConversationHistory::getPinnedAt, null));
            log.info("[ConversationHistory] action=batchUnpin staffId={} count={}", staffId, ids.size());
        } catch (CustomException e) {
            log.error("[ConversationHistory:Failed] action=batchUnpin staffId={}", staffId, e);
            throw e;
        }
    }

    private ConversationHistory requireAccessibleConversation(String id, String staffId) {
        ConversationHistory conversation = conversationHistoryMapper.selectOne(Wrappers.<ConversationHistory>lambdaQuery()
                .eq(ConversationHistory::getStaffId, staffId)
                .eq(ConversationHistory::getId, id));
        if (conversation == null) {
            throw new CustomException(HttpStatus.NOT_FOUND.value(), "Conversation not found");
        }
        return conversation;
    }


    private List<String> normalizeIds(List<String> conversationIds) {
        return conversationIds.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .distinct()
                .toList();
    }

}
