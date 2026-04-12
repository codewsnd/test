package com.demo.repository;

import com.demo.model.Group;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface GroupRepo extends MongoRepository<Group, String> {
    Optional<Group> findByName(String name);
    Page<Group> findAll(Pageable pageable);

}
