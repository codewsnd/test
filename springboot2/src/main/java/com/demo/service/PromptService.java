package com.demo.service;

import com.demo.context.StaffIdThreadLocal;
import com.demo.model.Prompt;
import com.demo.repository.PromptRepository;
import com.demo.utils.BQABeanUtils;
import com.demo.utils.BQAQueryUtils;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PromptService {

    @Autowired
    private PromptRepository promptRepository;
    @Autowired
    private MongoTemplate mongoTemplate;

    public Prompt createPrompt(Prompt prompt) {
        return promptRepository.save(prompt);
    }

    public Prompt getPrompt(String id) {
        return promptRepository.findById(id).orElseThrow(() -> new RuntimeException("Prompt not found"));
    }

    public Page<Prompt> pagePrompt(Pageable pageable, Prompt prompt) {
        Query query = BQAQueryUtils.buildQuery(prompt);
        long count = mongoTemplate.count(query, Prompt.class);
        query.with(pageable);
        List<Prompt> prompts = mongoTemplate.find(query, Prompt.class);
        return new PageImpl<>(prompts, pageable, count);
    }

    public Prompt updatePrompt(String id, Prompt prompt) {
        Prompt oldPrompt = getPrompt(id);
        BQABeanUtils.copyProperties(prompt, oldPrompt);
        return promptRepository.save(oldPrompt);
    }

    public void deletePrompt(String id) {
        promptRepository.deleteById(id);
    }

    public void likePrompt(String promptId) {
        String userId = StaffIdThreadLocal.getStaffId();
        Update update = new Update()
                .addToSet("likedUserIds", userId)
                .inc("likeCount", 1);

        mongoTemplate.updateFirst(
                Query.query(Criteria.where("id").is(promptId)
                        .and("likedUserIds").nin(userId)),
                update,
                Prompt.class
        );
    }

    public void unlikePrompt(String promptId) {
        String userId = StaffIdThreadLocal.getStaffId();
        Update update = new Update()
                .pull("likedUserIds", userId)
                .inc("likeCount", -1);

        mongoTemplate.updateFirst(
                Query.query(Criteria.where("id").is(promptId)
                        .and("likedUserIds").in(userId)),
                update,
                Prompt.class
        );
    }
}
