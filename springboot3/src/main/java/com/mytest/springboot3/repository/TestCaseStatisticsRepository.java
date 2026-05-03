package com.mytest.springboot3.repository;

import com.mytest.springboot3.entity.TestCaseStatistics;
import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TestCaseStatisticsRepository extends R2dbcRepository<TestCaseStatistics, String> {
}
