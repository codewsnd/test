package com.demo.service;

import com.demo.exception.BusinessException;
import com.demo.model.Group;
import com.demo.model.User;
import com.demo.repository.GroupRepo;
import com.demo.repository.UserRepo;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
public class UserService {

    @Autowired
    private UserRepo userRepo;

    @Autowired
    private GroupRepo groupRepo;

    public User getUserById(String id) {
        return userRepo.findById(id).orElseThrow(() -> new BusinessException("USER_NOT_FOUND", "User not found with ID: " + id));
    }

    public User getUserByStaffId(String staffId) {
        return userRepo.findByStaffId(staffId).orElseThrow(() -> new BusinessException("USER_NOT_FOUND", "User not found with staff ID: " + staffId));
    }

    public Page<User> getAllUsers(Pageable pageable) {
        return userRepo.findAll(pageable);
    }

    public User createUser(User newUser) {
        if (userRepo.existsByStaffId(newUser.getStaffId())) {
            throw new BusinessException("STAFF_ID_EXISTS", "Staff ID already exists: " + newUser.getStaffId());
        }

        // Validate group IDs
        validateGroupIds(newUser.getGroupIds());

        User savedUser = userRepo.save(newUser);
        log.info("Created user with ID: {} and staffId: {}", savedUser.getId(), savedUser.getStaffId());
        return savedUser;
    }

    public User updateUser(String id, User updatedUser) {
        Optional<User> existingUser = userRepo.findById(id);
        if (!existingUser.isPresent()) {
            throw new BusinessException("USER_NOT_FOUND", "User not found with ID: " + id);
        }

        // Validate group IDs
        validateGroupIds(updatedUser.getGroupIds());

        User user = existingUser.get();
        user.setUsername(updatedUser.getUsername());
        user.setStaffId(updatedUser.getStaffId());
        user.setAvatar(updatedUser.getAvatar());
        user.setGroupIds(updatedUser.getGroupIds());

        User savedUser = userRepo.save(user);
        log.info("Updated user with ID: {} and staffId: {}", savedUser.getId(), savedUser.getStaffId());
        return savedUser;
    }

    public void deleteUser(String id) {
        if (!userRepo.existsById(id)) {
            throw new BusinessException("USER_NOT_FOUND", "User not found with ID: " + id);
        }

        userRepo.deleteById(id);
        log.info("Deleted user with ID: {}", id);
    }

    public Set<String> getUserGroupNames(User user) {
        if (user == null) {
            return Collections.emptySet();
        }

        return user.getGroupIds().stream()
                .map(groupRepo::findById)
                .filter(Optional::isPresent)
                .map(Optional::get)
                .map(Group::getName)
                .map(String::toLowerCase)
                .collect(Collectors.toSet());
    }

    public boolean existsByStaffId(String staffId) {
        return userRepo.existsByStaffId(staffId);
    }

    private void validateGroupIds(Set<String> groupIds) {
        if (groupIds == null || groupIds.isEmpty()) {
            return;
        }

        for (String groupId : groupIds) {
            if (!groupRepo.existsById(groupId)) {
                throw new BusinessException("INVALID_GROUP_ID", "Invalid group ID: " + groupId);
            }
        }
    }
}
