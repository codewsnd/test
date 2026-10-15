"""FastMCP 服务入口。"""

from fastmcp import FastMCP

from tools import register_tools

mcp = FastMCP("fastmcp-project")
register_tools(mcp)


@mcp.tool
def add(a: int, b: int) -> int:
    """计算两个整数的和。"""
    return a + b


if __name__ == "__main__":
    mcp.run(transport="stdio")
