package com.demo.service;

import com.demo.exception.BusinessException;
import com.demo.model.Group;
import com.demo.repository.GroupRepo;
import com.demo.repository.UserRepo;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Slf4j
@Service
public class GroupService {

    @Autowired
    private GroupRepo groupRepo;

    @Autowired
    private UserRepo userRepo;

    public Page<Group> getAllGroups(Pageable pageable) {
        return groupRepo.findAll(pageable);
    }

    public Group getGroupById(String groupId) {
        return groupRepo.findById(groupId).orElseThrow(() -> new BusinessException("GROUP_NOT_FOUND", "Group not found with ID: " + groupId));
    }

    public Group getGroupByName(String name) {
        Optional<Group> groupOpt = groupRepo.findByName(name);
        return groupOpt.orElse(null);
    }

    public Group createGroup(Group group) {
        if (groupRepo.findByName(group.getName()).isPresent()) {
            throw new BusinessException("GROUP_NAME_EXISTS", "Group name already exists: " + group.getName());
        }

        Group savedGroup = groupRepo.save(group);
        log.info("Created group with ID: {} and name: {}", savedGroup.getId(), savedGroup.getName());
        return savedGroup;
    }

    public Group updateGroup(String id, Group updatedGroup) {
        Optional<Group> existingGroup = groupRepo.findById(id);
        if (!existingGroup.isPresent()) {
            throw new BusinessException("GROUP_NOT_FOUND", "Group not found with ID: " + id);
        }

        Group group = existingGroup.get();
        group.setName(updatedGroup.getName());
        group.setBgColor(updatedGroup.getBgColor());
        group.setFontColor(updatedGroup.getFontColor());

        Group savedGroup = groupRepo.save(group);
        log.info("Updated group with ID: {} and name: {}", savedGroup.getId(), savedGroup.getName());
        return savedGroup;
    }

    public void deleteGroup(String id, String staffId) {
        if (!groupRepo.existsById(id)) {
            throw new BusinessException("GROUP_NOT_FOUND", "Group not found with ID: " + id);
        }

        long userCount = userRepo.countByGroupIdsContaining(id);
        if (userCount > 0) {
            throw new BusinessException("GROUP_IN_USE", "Cannot delete group: " + userCount + " users belong to this group");
        }

        groupRepo.deleteById(id);
        log.info("Deleted group with ID: {} by staff: {}", id, staffId);
    }

    public boolean existsById(String groupId) {
        return groupRepo.existsById(groupId);
    }

    public boolean existsByName(String name) {
        return groupRepo.findByName(name).isPresent();
    }
}
