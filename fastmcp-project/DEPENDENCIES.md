# Python 依赖说明

本文依据 2026-10-15 的 `requirements.txt`，介绍每个依赖的作用、典型使用场景及当前声明含义，也包含已注释的 `psycopg2-binary`。

清单涉及 **27 个不同的包**：26 个启用、1 个已注释；由于 `truststore` 声明了两次，启用的依赖声明共有 27 行。下表按文件中的顺序列出所有声明。

文中的典型用途用于解释包的能力，不代表项目已经实现了这些功能。当前天气服务主要使用 FastMCP，天气数据来自本地 Mock；业务代码尚未连接 PostgreSQL、Redis 或 AWS，也没有使用 Excel、Arrow 或 DuckDB 处理数据。

## 版本约束怎么读

| 写法 | 含义 |
| --- | --- |
| `fastmcp==3.2.4` | 固定使用 `3.2.4`。 |
| `pydantic>=2.7.0` | 允许 `2.7.0` 及以上版本，但仍需满足 Python 版本和其他依赖的约束。 |
| `mdurl>0.1,<0.2` | 同时满足大于 `0.1`、小于 `0.2`，例如 `0.1.2`。 |
| `urllib3` | 本行没有指定版本范围，pip 仍需结合其他依赖和当前环境选择版本。 |
| `#psycopg2-binary==2.9.9` | 注释行，`pip install -r requirements.txt` 会忽略这一行。 |

`requirements.txt` 中的最低版本不一定是最终安装版本。例如 FastMCP 3.2.4 要求 `pydantic[email]>=2.11.7` 和 `httpx>=0.28.1,<1.0`，因此还要与本文件中的约束取交集。这两项现有下限较宽，本身不构成冲突。[FastMCP 3.2.4 依赖元数据](https://pypi.org/pypi/fastmcp/3.2.4/json)

## 每个依赖的作用

| 依赖声明 | 主要作用 | 典型用途与说明 |
| --- | --- | --- |
| `fastmcp==3.2.4` | 构建 MCP 服务和客户端。 | 将 Python 函数注册为 MCP 工具，向客户端提供资源等能力。本项目使用它注册加法、文本天气、天气卡片工具及 HTML 资源。[官方文档](https://gofastmcp.com/) |
| `uvicorn==0.38.0` | 运行 ASGI Web 应用的服务器。 | 负责监听端口、接收 HTTP 请求并交给应用处理。适用于 FastMCP 的 HTTP 服务，以及 FastAPI、Starlette 应用；它本身不定义业务接口。[官方文档](https://uvicorn.dev/) |
| `openpyxl==3.1.5` | 读取、创建和修改现代 Excel 文件。 | 处理 `.xlsx`、`.xlsm` 中的工作表、单元格、样式等，适合报表生成和 Excel 数据导入导出；不用于读取旧版 `.xls`。[官方文档](https://openpyxl.readthedocs.io/en/stable/) |
| `xlrd==2.0.1` | 读取旧版 Excel `.xls` 文件。 | 用于提取旧格式工作簿的数据。2.x 不支持 `.xlsx`，也不负责写入 Excel 文件。[官方文档](https://xlrd.readthedocs.io/en/latest/) |
| `python-dotenv>=1.1.0` | 从 `.env` 文件加载环境变量。 | 常用于管理服务地址、数据库配置和 API Key。代码导入名为 `dotenv`；应用通常调用 `load_dotenv()`，或由框架负责加载。[官方仓库](https://github.com/theskumar/python-dotenv) |
| `pydantic>=2.7.0` | 基于 Python 类型标注验证、解析和序列化数据。 | 定义请求参数、响应对象和配置模型；输入不符合约束时产生验证错误。FastMCP 和 FastAPI 都会使用它处理结构化数据。[官方资料](https://pypi.org/project/pydantic/) |
| `duckdb>=1.0.0` | 在进程内执行 SQL 的分析型数据库。 | 适合查询 CSV、Parquet 和本地分析数据，可使用内存数据库或本地数据库文件；通常不需要单独启动数据库服务。[官方文档](https://duckdb.org/docs/stable/clients/python/overview) |
| `pyarrow>=15.0.0` | Apache Arrow 的 Python 接口，处理列式数据。 | 用于 Arrow 数据结构、Parquet 文件读写和数据交换，适合批量数据处理；与 DuckDB 配合时可减少重复转换。[官方文档](https://arrow.apache.org/docs/python/) |
| `lxml>=5.0.0` | 解析、查询和生成 XML、HTML。 | 支持 XPath、XML 树操作等，适合处理网页内容、XML 配置和结构化文档。[官方资料](https://pypi.org/project/lxml/) |
| `#psycopg2-binary==2.9.9` | PostgreSQL 数据库驱动，当前已注释。 | 用于连接 PostgreSQL、执行 SQL 和管理事务，代码导入名是 `psycopg2`。这一行当前不会参与安装；历史安装失败原因见下文。[官方文档](https://www.psycopg.org/docs/) |
| `cryptography>=46.0.0` | 提供加密、签名、密钥及证书处理能力。 | 可用于对称加密、非对称签名和 X.509 证书操作，也常被认证相关库间接使用。[官方文档](https://cryptography.io/) |
| `pytest>=7.2.0` | Python 自动化测试框架。 | 提供测试发现、断言、fixture 和参数化等能力。本项目现有测试使用标准库 `unittest`，运行这些测试不必改写为 pytest。[官方文档](https://docs.pytest.org/en/stable/) |
| `pytest-asyncio>=0.21.0` | 为 pytest 提供 asyncio 异步测试支持。 | 用于执行 `async def` 测试和管理异步 fixture。本项目现有测试使用 `unittest.IsolatedAsyncioTestCase`，不是通过该插件驱动。[官方文档](https://pytest-asyncio.readthedocs.io/) |
| `requests>=2.31.0` | 面向同步调用的 HTTP 客户端。 | 用于访问 REST API、提交表单、上传和下载文件等；请求完成前通常会阻塞当前调用线程。[官方文档](https://requests.readthedocs.io/) |
| `httpx>=0.27.0` | 同时支持同步和异步调用的 HTTP 客户端。 | `Client` 用于同步请求，`AsyncClient` 用于异步请求，适合异步工具调用外部 HTTP 服务。[官方文档](https://www.python-httpx.org/) |
| `uuid6>=2025.0.1` | 生成与时间有关的 UUID。 | 提供 `uuid6()`、`uuid7()`、`uuid8()` 等接口，可用于记录 ID、请求 ID 或数据库主键；这些 UUID 格式有助于按时间组织数据。[项目说明](https://pypi.org/project/uuid6/2025.0.1/) |
| `jinja2>=3.1.4` | 文本模板引擎。 | 根据变量、条件和循环生成 HTML、邮件、提示词或配置文本，导入名为 `jinja2`。当前天气卡片直接读取静态 HTML，没有使用 Jinja2 渲染。[官方资料](https://pypi.org/project/Jinja2/) |
| `truststore>=0.10.0` | 让 Python TLS 连接使用系统证书信任库。 | 适用于需要采用操作系统受信任证书的 HTTPS 访问，例如企业证书环境。通常需要应用或相关工具显式接入；安装包并不等于所有请求自动切换证书来源。[项目说明](https://pypi.org/project/truststore/) |
| `pyjwt==2.15.1` | 编码、解码和验证 JWT。 | 常用于令牌签名和身份认证，代码导入名是 `jwt`。JWT 签名用于验证内容完整性和签发方，本身不代表令牌内容已加密。[官方资料](https://pypi.org/project/PyJWT/2.15.1/) |
| `redis==7.0.1` | Redis 的 Python 客户端。 | 连接 Redis 服务，操作缓存、键值数据、发布订阅或 Stream。安装这个包不会安装或启动 Redis 服务端。[官方文档](https://redis.readthedocs.io/en/latest/) |
| `boto3==1.40.72` | AWS 的 Python SDK。 | 调用 S3、DynamoDB 等 AWS 服务，例如上传文件到 S3。实际调用需要相应服务配置、凭据和权限。[官方文档](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html) |
| `urllib3` | 提供连接池、重试和 TLS 等能力的 HTTP 库。 | 可直接使用，也被 Requests 等库作为底层依赖使用。它与 Python 标准库中的 `urllib` 是不同的库。[官方文档](https://urllib3.readthedocs.io/) |
| `fastapi>=0.139.0` | 构建 HTTP API 的 Web 框架。 | 定义 REST 接口，处理请求参数和响应，并生成 OpenAPI 文档。常配合 Pydantic 做数据验证、Uvicorn 提供 HTTP 服务。[官方资料](https://pypi.org/project/fastapi/0.139.0/) |
| `starlette==1.3.1` | ASGI Web 框架与基础组件库。 | 提供路由、请求响应、中间件、WebSocket 等能力，也是 FastAPI 的基础依赖。正确包名是 `starlette`，原来的 `stawrtlette` 是拼写错误。[官方资料](https://pypi.org/project/starlette/1.3.1/) |
| `truststore>=0.9.1` | 与前面的 `truststore` 是同一个包。 | 这条声明按要求保留。两条约束同时生效，合起来相当于 `truststore>=0.10.0`，不会安装两份不同版本的 truststore。[项目说明](https://pypi.org/project/truststore/) |
| `mdurl>0.1,<0.2` | 处理 Markdown 中 URL 的解析和编码等细节。 | 常作为 Markdown 解析工具的辅助依赖；它不是完整的 Markdown 渲染器，也不是发起网络请求的 HTTP 客户端。[项目说明](https://pypi.org/project/mdurl/) |
| `pysonar==1.2.1.3951` | SonarScanner for Python，封装 SonarScanner CLI。 | 用于发起代码质量分析并与 SonarQube Server 或 Cloud 配合使用。安装后还需要配置项目、服务地址及认证信息；它不负责运行单元测试或生成测试覆盖率。[官方文档](https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/scanners/sonarscanner-for-python) |
| `coverage==7.11.0` | 测量 Python 代码的测试覆盖率。 | 跟踪测试执行到的语句或分支，生成终端、HTML、XML 等报告，可配合 unittest 或 pytest 使用。它不等同于 `pytest-cov` 插件。[官方文档](https://coverage.readthedocs.io/en/7.11.0/) |

## 已注释的 psycopg2-binary

当前文件中的原文是：

```txt
#psycopg2-binary==2.9.9
```

该包用于访问 PostgreSQL。如果后续业务需要数据库连接，通常会通过 `import psycopg2` 使用它。当前天气工具只读取内存中的固定数据，没有调用该驱动，因此注释这一项不影响现有天气查询逻辑。

之前的安装错误发生在 Windows / Python 3.14 环境：`2.9.9` 没有对应的预编译 wheel，pip 改为下载 `.tar.gz` 源码包；源码构建需要 PostgreSQL 的 `pg_config`，当前环境未找到它，因而失败。官方在 `2.9.9` 加入 Python 3.12 支持，在 `2.9.11` 才加入 Python 3.14 支持。[2.9.9 发行文件](https://pypi.org/project/psycopg2-binary/2.9.9/#files)、[官方发布说明](https://www.psycopg.org/docs/news.html)

注释此行会让 pip 跳过这条安装要求，但不会卸载已经装在环境中的包，也不会阻止其他包通过间接依赖引入它。未来恢复该依赖时，需要重新检查 Python 与驱动的兼容性；仅补充 `pg_config` 不能证明旧驱动兼容 Python 3.14。本文保留原有版本声明，不调整依赖版本。

## 容易混淆的依赖关系

| 组合 | 各自负责什么 |
| --- | --- |
| FastMCP / FastAPI / Starlette / Uvicorn | FastMCP 提供 MCP 工具与资源；FastAPI 定义 HTTP API；Starlette 提供 ASGI Web 基础组件；Uvicorn 负责运行 ASGI 应用并监听 HTTP 端口。当前项目创建的是 `FastMCP` 服务，没有自行创建 `FastAPI` 应用。 |
| Requests / HTTPX / urllib3 | 都与 HTTP 通信有关。Requests 主要提供同步请求接口；HTTPX 提供同步与异步接口；urllib3 提供连接池等较底层的能力，也是 Requests 的依赖。 |
| openpyxl / xlrd | openpyxl 用于现代 `.xlsx`、`.xlsm` 的读写；xlrd 2.x 用于旧版 `.xls` 的读取。 |
| DuckDB / PyArrow | DuckDB 侧重 SQL 查询与分析；PyArrow 侧重列式数据结构、文件格式及数据交换，两者可以配合使用。 |
| pytest / pytest-asyncio / coverage / pysonar | pytest 执行测试；pytest-asyncio 为 pytest 补充异步测试能力；coverage 统计执行覆盖率；pysonar 发起 SonarQube 代码质量分析。 |

## 当前项目使用情况与范围

- `server.py`、`tools/__init__.py` 和天气工具模块直接使用 `fastmcp`。
- 天气工具还从 `mcp.types` 导入 `ToolAnnotations`；`mcp` 由 FastMCP 的依赖链引入，未单独列在本文件中。
- `tests/test_weather.py` 使用 Python 标准库的 `unittest`、`asyncio` 和 FastMCP 客户端测试工具与资源。
- `tools/weather/templates/weather.html` 是静态模板，通过 `Path.read_text()` 返回。它在浏览器中使用 MCP Apps JavaScript SDK，这部分不属于 Python 的 `requirements.txt`。
- 清单中的其他包可能用于间接依赖、开发工具或后续功能，不能仅凭它们出现在清单中就认定项目已具备数据库、缓存、云存储或数据分析功能。

本文是依赖用途说明，不是完整安装验证报告。实际安装版本及可安装性取决于 Python 版本、操作系统、包索引和全部依赖约束。
