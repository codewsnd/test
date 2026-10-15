"""固定的模拟天气数据，不调用外部天气接口。"""

from dataclasses import dataclass

from fastmcp.exceptions import ToolError

DEFAULT_CITY = "北京"


@dataclass(frozen=True)
class Weather:
    city: str
    condition: str
    temperature_c: int
    feels_like_c: int
    humidity_percent: int
    wind: str
    low_c: int
    high_c: int
    is_mock: bool = True


MOCK_WEATHER = {
    "北京": Weather("北京", "晴", 23, 22, 35, "北风 2 级", 14, 25),
    "上海": Weather("上海", "多云", 25, 26, 68, "东风 3 级", 20, 27),
    "广州": Weather("广州", "阵雨", 28, 31, 82, "南风 2 级", 24, 30),
    "深圳": Weather("深圳", "晴间多云", 29, 32, 75, "东南风 3 级", 25, 31),
    "杭州": Weather("杭州", "小雨", 21, 20, 86, "东北风 2 级", 18, 23),
}


def get_mock_weather(city: str) -> Weather:
    """查询固定样例，接受城市名前后空格及可选的“市”后缀。"""
    normalized_city = city.strip().removesuffix("市")
    if not normalized_city:
        raise ToolError("城市名称不能为空。")
    if normalized_city not in MOCK_WEATHER:
        supported_cities = "、".join(MOCK_WEATHER)
        raise ToolError(f"暂无该城市的 Mock 数据，支持：{supported_cities}。")
    return MOCK_WEATHER[normalized_city]


def format_weather(weather: Weather) -> str:
    """生成供用户和不支持 MCP Apps 的客户端阅读的普通文本。"""
    return (
        "【Mock 模拟天气，非实时数据】\n"
        f"城市：{weather.city}\n"
        f"天气：{weather.condition}\n"
        f"温度：{weather.temperature_c}°C（体感 {weather.feels_like_c}°C）\n"
        f"最低 / 最高：{weather.low_c}°C / {weather.high_c}°C\n"
        f"湿度：{weather.humidity_percent}%\n"
        f"风况：{weather.wind}"
    )
