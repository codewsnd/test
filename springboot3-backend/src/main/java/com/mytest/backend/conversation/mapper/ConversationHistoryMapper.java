package com.mytest.backend.conversation.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.mytest.backend.conversation.entity.ConversationHistoryDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ConversationHistoryMapper extends BaseMapper<ConversationHistoryDO> {

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
            WHERE user_id = #{staffId}
              AND COALESCE(is_deleted, FALSE) = FALSE
              AND (
                  #{search} = ''
                  OR title ILIKE CONCAT('%', #{search}, '%')
                  OR COALESCE(conversation_state::text, '') ILIKE CONCAT('%', #{search}, '%')
              )
            ORDER BY is_pinned DESC NULLS LAST, pinned_at DESC NULLS LAST, updated_at DESC
            """)
    Page<ConversationHistoryDO> selectPageByStaffIdAndSearch(
            Page<ConversationHistoryDO> page,
            @Param("staffId") String staffId,
            @Param("search") String search
    );
}
