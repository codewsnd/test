package com.mytest.backend.conversation.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.JsonNode;
import com.mytest.backend.conversation.entity.ConversationHistory;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.Instant;

@Mapper
public interface ConversationHistoryMapper extends BaseMapper<ConversationHistory> {

    @Select("""
            SELECT
                id,
                title,
                is_pinned,
                created_at,
                updated_at,
                pinned_at,
                user_id AS staff_id,
                title_generating,
                is_deleted
            FROM conversation_history
            WHERE user_id = #{staffId}
              AND COALESCE(is_deleted, FALSE) = FALSE
              AND (
                  #{search} = ''
                  OR title ILIKE CONCAT('%', #{search}, '%')
                  OR COALESCE(conversation_state::text, '') ILIKE CONCAT('%', #{search}, '%')
              )
            ORDER BY is_pinned DESC NULLS LAST, pinned_at DESC NULLS LAST, updated_at DESC
            """)
    Page<ConversationHistory> pageConversations(
            Page<ConversationHistory> page,
            @Param("staffId") String staffId,
            @Param("search") String search
    );

    @Update("""
            WITH patch AS (
                SELECT CAST(
                    #{conversationStatePatch,jdbcType=OTHER,typeHandler=com.mytest.backend.conversation.typehandler.JsonbJsonNodeTypeHandler}
                    AS jsonb
                ) AS patch_data
            )
            UPDATE conversation_history AS ch
            SET conversation_state = CASE
                    WHEN NOT jsonb_exists(patch.patch_data, 'turns') THEN
                        COALESCE(ch.conversation_state, '{}'::jsonb) || (patch.patch_data - 'turns')
                    WHEN jsonb_typeof(patch.patch_data -> 'turns') = 'null' THEN
                        jsonb_set(
                            COALESCE(ch.conversation_state, '{}'::jsonb) || (patch.patch_data - 'turns'),
                            '{turns}',
                            '[]'::jsonb,
                            true
                        )
                    ELSE
                        jsonb_set(
                            COALESCE(ch.conversation_state, '{}'::jsonb) || (patch.patch_data - 'turns'),
                            '{turns}',
                            COALESCE((
                                SELECT jsonb_agg(merged_turn ORDER BY merged_turn_timestamp NULLS LAST, merged_turn_id NULLS LAST)
                                FROM (
                                    SELECT
                                        merged_turn,
                                        merged_turn ->> 'timestamp' AS merged_turn_timestamp,
                                        merged_turn ->> 'id' AS merged_turn_id
                                    FROM (
                                        SELECT existing_turn AS merged_turn
                                        FROM jsonb_array_elements(
                                            CASE
                                                WHEN jsonb_typeof(
                                                        COALESCE(ch.conversation_state, '{}'::jsonb) -> 'turns'
                                                     ) = 'array'
                                                    THEN COALESCE(ch.conversation_state, '{}'::jsonb) -> 'turns'
                                                ELSE '[]'::jsonb
                                            END
                                        ) AS existing(existing_turn)
                                        WHERE NOT EXISTS (
                                            SELECT 1
                                            FROM jsonb_array_elements(patch.patch_data -> 'turns') AS patched(patched_turn)
                                            WHERE patched_turn ->> 'id' = existing_turn ->> 'id'
                                        )
                                        UNION ALL
                                        SELECT patched_turn AS merged_turn
                                        FROM jsonb_array_elements(patch.patch_data -> 'turns') AS patched(patched_turn)
                                    ) merged_values
                                ) ordered_values
                            ), '[]'::jsonb),
                            true
                        )
                END,
                updated_at = COALESCE(#{updatedAt,jdbcType=TIMESTAMP}, NOW())
            FROM patch
            WHERE ch.id = #{id}
              AND ch.user_id = #{staffId}
              AND COALESCE(ch.is_deleted, FALSE) = FALSE
            """)
    int saveConversationState(
            @Param("id") String id,
            @Param("staffId") String staffId,
            @Param("conversationStatePatch") JsonNode conversationStatePatch,
            @Param("updatedAt") Instant updatedAt
    );
}
