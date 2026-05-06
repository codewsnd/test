package com.mytest.backend.conversation.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.mytest.backend.conversation.entity.ConversationHistory;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.Instant;
import java.util.List;

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
    Page<ConversationHistory> selectPageByStaffIdAndSearch(
            Page<ConversationHistory> page,
            @Param("staffId") String staffId,
            @Param("search") String search
    );

    @Select("""
            SELECT COUNT(1)
            FROM conversation_history
            WHERE id = #{id}
            """)
    int countById(@Param("id") String id);

    @Select("""
            SELECT
                id,
                title,
                conversation_state,
                is_pinned,
                created_at,
                updated_at,
                pinned_at,
                user_id AS staff_id,
                title_generating,
                is_deleted
            FROM conversation_history
            WHERE id = #{id}
              AND user_id = #{staffId}
              AND COALESCE(is_deleted, FALSE) = FALSE
            """)
    ConversationHistory selectAccessibleById(
            @Param("id") String id,
            @Param("staffId") String staffId
    );

    @Select("""
            <script>
            SELECT COUNT(1)
            FROM conversation_history
            WHERE user_id = #{staffId}
              AND COALESCE(is_deleted, FALSE) = FALSE
              AND id IN
              <foreach collection="ids" item="id" open="(" separator="," close=")">
                  #{id}
              </foreach>
            </script>
            """)
    int countAccessibleByIds(
            @Param("staffId") String staffId,
            @Param("ids") List<String> ids
    );

    @Update("""
            UPDATE conversation_history
            SET title = #{title},
                title_generating = FALSE,
                updated_at = #{updatedAt}
            WHERE id = #{id}
              AND user_id = #{staffId}
              AND COALESCE(is_deleted, FALSE) = FALSE
            """)
    int renameConversation(
            @Param("id") String id,
            @Param("staffId") String staffId,
            @Param("title") String title,
            @Param("updatedAt") Instant updatedAt
    );

    @Update("""
            <script>
            UPDATE conversation_history
            SET is_deleted = TRUE
            WHERE user_id = #{staffId}
              AND COALESCE(is_deleted, FALSE) = FALSE
              AND id IN
              <foreach collection="ids" item="id" open="(" separator="," close=")">
                  #{id}
              </foreach>
            </script>
            """)
    int softDeleteByStaffIdAndIds(
            @Param("staffId") String staffId,
            @Param("ids") List<String> ids
    );

    @Update("""
            <script>
            UPDATE conversation_history
            SET is_pinned = TRUE,
                pinned_at = #{pinnedAt}
            WHERE user_id = #{staffId}
              AND COALESCE(is_deleted, FALSE) = FALSE
              AND id IN
              <foreach collection="ids" item="id" open="(" separator="," close=")">
                  #{id}
              </foreach>
            </script>
            """)
    int pinByStaffIdAndIds(
            @Param("staffId") String staffId,
            @Param("ids") List<String> ids,
            @Param("pinnedAt") Instant pinnedAt
    );

    @Update("""
            <script>
            UPDATE conversation_history
            SET is_pinned = FALSE,
                pinned_at = NULL
            WHERE user_id = #{staffId}
              AND COALESCE(is_deleted, FALSE) = FALSE
              AND id IN
              <foreach collection="ids" item="id" open="(" separator="," close=")">
                  #{id}
              </foreach>
            </script>
            """)
    int unpinByStaffIdAndIds(
            @Param("staffId") String staffId,
            @Param("ids") List<String> ids
    );

    @Update("""
            WITH patch AS (
                SELECT CAST(#{conversationStatePatchJson} AS jsonb) AS patch_data
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
                                SELECT jsonb_agg(merged_turn ORDER BY merged_turn_index, merged_turn_id)
                                FROM (
                                    SELECT
                                        merged_turn,
                                        CASE
                                            WHEN (merged_turn ->> 'turnIndex') ~ '^[0-9]+$'
                                                THEN (merged_turn ->> 'turnIndex')::integer
                                            ELSE 2147483647
                                        END AS merged_turn_index,
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
    int patchConversationState(
            @Param("id") String id,
            @Param("staffId") String staffId,
            @Param("conversationStatePatchJson") String conversationStatePatchJson,
            @Param("updatedAt") Instant updatedAt
    );
}
