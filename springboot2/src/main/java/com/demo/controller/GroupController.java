package com.demo.controller;

import com.demo.annotation.Permission;
import com.demo.model.Group;
import com.demo.service.GroupService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.*;

import static com.demo.constants.CommonConstants.ADMIN;

@RestController
@RequestMapping("/groups")
public class GroupController {

    @Autowired
    private GroupService groupService;

    @GetMapping
    public Page<Group> pageGroups(@PageableDefault(sort = "updatedAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return groupService.getAllGroups(pageable);
    }

    @PostMapping
    @Permission(groups = ADMIN)
    public Group createGroup(@RequestBody Group group) {
        return groupService.createGroup(group);
    }

    @PutMapping("/{id}")
    @Permission(groups = ADMIN)
    public Group updateGroup(@PathVariable String id, @RequestBody Group updatedGroup) {
        return groupService.updateGroup(id, updatedGroup);
    }

    @DeleteMapping("/{id}")
    @Permission(groups = ADMIN)
    public void deleteGroup(@PathVariable String id, @RequestParam String staffId) {
        groupService.deleteGroup(id, staffId);
    }

    @GetMapping("/{id}")
    public Group getGroupById(@PathVariable String id) {
        return groupService.getGroupById(id);
    }
}
