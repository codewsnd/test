#!/bin/bash

# CopyDeckService 单元测试运行脚本
# 使用说明：
#   ./run-test.sh           - 运行测试并生成覆盖率报告
#   ./run-test.sh quick     - 只运行测试，不生成报告
#   ./run-test.sh check     - 运行测试并检查是否达到80%覆盖率

set -e

PROJECT_DIR="/d/github/demo/springboot3-backend"
TEST_CLASS="CopyDeckServiceTest"

cd "$PROJECT_DIR"

echo "=================================="
echo "  CopyDeckService 单元测试"
echo "=================================="
echo ""

case "${1:-default}" in
    quick)
        echo "🚀 快速运行测试..."
        mvn test -Dtest=$TEST_CLASS
        ;;
    check)
        echo "🔍 运行测试并检查覆盖率..."
        mvn clean test jacoco:check -Dtest=$TEST_CLASS
        echo ""
        echo "✅ 覆盖率检查通过（≥ 80%）"
        ;;
    report)
        echo "📊 生成完整覆盖率报告..."
        mvn clean test jacoco:report
        echo ""
        echo "📁 报告位置: target/site/jacoco/index.html"
        echo ""
        # 尝试在浏览器中打开报告
        if command -v explorer.exe &> /dev/null; then
            echo "🌐 在浏览器中打开报告..."
            explorer.exe "$(wslpath -w "$PROJECT_DIR/target/site/jacoco/index.html")" 2>/dev/null || true
        fi
        ;;
    *)
        echo "📦 运行测试并生成覆盖率报告..."
        mvn clean test jacoco:report -Dtest=$TEST_CLASS
        echo ""
        echo "✅ 测试完成！"
        echo ""
        echo "📊 覆盖率报告: target/site/jacoco/index.html"
        echo ""
        echo "💡 提示："
        echo "  - 运行 ./run-test.sh quick   快速测试"
        echo "  - 运行 ./run-test.sh check   检查覆盖率"
        echo "  - 运行 ./run-test.sh report  生成完整报告"
        ;;
esac

echo ""
echo "=================================="
