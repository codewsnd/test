"""通过 MCP 客户端验证工具和资源的公开协议。"""

import asyncio
import unittest

from fastmcp import Client

from server import mcp

VIEW_URI = "ui://weather/view.html"
TOOL_NAMES = ("get_weather_text", "get_weather_app")


class WeatherProtocolTests(unittest.IsolatedAsyncioTestCase):
    async def test_discovery_links_only_app_tool_to_html(self):
        async with Client(mcp) as client:
            tools = {tool.name: tool for tool in await client.list_tools()}
        self.assertIn("add", tools)
        self.assertNotIn("ui", tools["get_weather_text"].meta or {})
        self.assertEqual(tools["get_weather_app"].meta["ui"]["resourceUri"], VIEW_URI)
        for name in TOOL_NAMES:
            self.assertTrue(tools[name].annotations.readOnlyHint)
            self.assertFalse(tools[name].annotations.openWorldHint)

    async def test_text_is_plain_text_and_normalizes_city(self):
        async with Client(mcp) as client:
            result = await client.call_tool("get_weather_text", {"city": " 上海市 "})
        self.assertFalse(result.is_error)
        self.assertIsNone(result.structured_content)
        self.assertEqual(len(result.content), 1)
        self.assertEqual(result.content[0].type, "text")
        self.assertIn("城市：上海", result.content[0].text)
        self.assertIn("温度：25°C", result.content[0].text)
        self.assertIn("Mock", result.content[0].text)

    async def test_app_has_matching_text_fallback_and_structured_data(self):
        async with Client(mcp) as client:
            text = await client.call_tool("get_weather_text", {})
            app = await client.call_tool("get_weather_app", {})
        self.assertEqual(app.content[0].text, text.content[0].text)
        self.assertEqual(app.structured_content["city"], "北京")
        self.assertEqual(app.structured_content["temperature_c"], 23)
        self.assertTrue(app.structured_content["is_mock"])

    async def test_city_requests_are_deterministic_and_independent(self):
        cities = ["北京", "上海", "广州", "深圳", "杭州"]
        async with Client(mcp) as client:
            results = await asyncio.gather(*(
                client.call_tool("get_weather_app", {"city": city}) for city in cities
            ))
            repeated = await client.call_tool("get_weather_app", {"city": "上海"})
        self.assertEqual([result.structured_content["city"] for result in results], cities)
        self.assertEqual(repeated.structured_content, results[1].structured_content)

    async def test_invalid_cities_return_tool_errors(self):
        async with Client(mcp) as client:
            for name in TOOL_NAMES:
                for city, message in (("   ", "不能为空"), ("火星", "支持：")):
                    with self.subTest(tool=name, city=city):
                        result = await client.call_tool(name, {"city": city}, raise_on_error=False)
                        self.assertTrue(result.is_error)
                        self.assertIn(message, result.content[0].text)

    async def test_app_resource_exposes_html_and_sdk_csp(self):
        async with Client(mcp) as client:
            resources = {str(resource.uri): resource for resource in await client.list_resources()}
            contents = await client.read_resource(VIEW_URI)
        self.assertEqual(resources[VIEW_URI].mimeType, "text/html;profile=mcp-app")
        self.assertEqual(len(contents), 1)
        resource = contents[0]
        self.assertEqual(resource.mimeType, "text/html;profile=mcp-app")
        self.assertTrue(resource.text.startswith("<!DOCTYPE html>"))
        self.assertIn("app.ontoolresult = handleToolResult", resource.text)
        self.assertIn("app.callServerTool", resource.text)
        self.assertIn("@modelcontextprotocol/ext-apps@0.4.0", resource.text)
        self.assertIn("var WeatherAppSDK=", resource.text)
        self.assertNotIn("/* __WEATHER_APP_SDK__ */", resource.text)
        self.assertNotIn("unpkg.com", resource.text)
        self.assertNotIn("import(SDK_URL)", resource.text)
        self.assertEqual(resource.meta["ui"]["csp"]["resourceDomains"], [])
        self.assertEqual(resource.meta["ui"]["csp"]["connectDomains"], [])


if __name__ == "__main__":
    unittest.main()
