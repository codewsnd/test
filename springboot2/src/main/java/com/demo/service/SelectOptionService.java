package com.demo.service;

import com.demo.model.SelectOption;
import com.demo.repository.SelectOptionRepository;
import com.demo.utils.BQAQueryUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class SelectOptionService {

    @Autowired
    private SelectOptionRepository repository;
    @Autowired
    private MongoTemplate mongoTemplate;

    public SelectOption create(SelectOption option) {
        return repository.save(option);
    }

    public SelectOption getById(String id) {
        return repository.findById(id).orElse(null);
    }

    public SelectOption update(String id, SelectOption option) {
        option.setId(id);
        return repository.save(option);
    }

    public void delete(String id) {
        repository.deleteById(id);
    }

    public List<SelectOption> listSelectOption(SelectOption selectOption) {
        Query query = BQAQueryUtils.buildQuery(selectOption);
        return mongoTemplate.find(query, SelectOption.class);
    }

    public SelectOption addOption(String id, SelectOption.Option option) {
        return repository.findById(id).map(selectOption -> {
            if (selectOption.getOptions() == null) {
                selectOption.setOptions(new ArrayList<>());
            }
            selectOption.getOptions().add(option);
            return repository.save(selectOption);
        }).orElseThrow(() -> new RuntimeException("SelectOption not found"));
    }

    public SelectOption deleteOption(String id, int index) {
        return repository.findById(id).map(selectOption -> {
            if (selectOption.getOptions() == null || index < 0 || index >= selectOption.getOptions().size()) {
                throw new IndexOutOfBoundsException("Invalid option index");
            }
            selectOption.getOptions().remove(index);
            return repository.save(selectOption);
        }).orElseThrow(() -> new RuntimeException("SelectOption not found"));
    }

    public SelectOption updateOption(String id, int index, SelectOption.Option option) {
        return repository.findById(id).map(selectOption -> {
            if (selectOption.getOptions() == null || index < 0 || index >= selectOption.getOptions().size()) {
                throw new IndexOutOfBoundsException("Invalid option index");
            }
            selectOption.getOptions().set(index, option);
            return repository.save(selectOption);
        }).orElseThrow(() -> new RuntimeException("SelectOption not found"));
    }

    public SelectOption moveOption(String id, int fromIndex, int toIndex) {
        return repository.findById(id).map(selectOption -> {
            List<SelectOption.Option> options = selectOption.getOptions();
            if (options == null ||
                    fromIndex < 0 || fromIndex >= options.size() ||
                    toIndex < 0 || toIndex >= options.size()) {
                throw new IndexOutOfBoundsException("Invalid option indices");
            }

            SelectOption.Option option = options.remove(fromIndex);
            options.add(toIndex, option);

            for (int i = 0; i < options.size(); i++) {
                options.get(i).setSortOrder(i + 1);
            }

            return repository.save(selectOption);
        }).orElseThrow(() -> new RuntimeException("SelectOption not found"));
    }
}
