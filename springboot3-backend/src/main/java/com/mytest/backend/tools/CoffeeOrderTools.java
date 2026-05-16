package com.mytest.backend.tools;

import com.mytest.backend.tools.a2ui.A2uiResource;
import com.mytest.backend.tools.a2ui.A2uiResourceFactory;
import com.mytest.backend.tools.a2ui.A2uiToolDefinition;
import com.mytest.backend.tools.a2ui.A2uiToolProvider;
import com.mytest.backend.tools.a2ui.A2uiToolSchema;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

import static com.mytest.backend.tools.a2ui.A2uiArguments.optionalString;
import static com.mytest.backend.tools.a2ui.A2uiProtocol.action;
import static com.mytest.backend.tools.a2ui.A2uiProtocol.bind;
import static com.mytest.backend.tools.a2ui.A2uiProtocol.component;
import static com.mytest.backend.tools.a2ui.A2uiProtocol.list;
import static com.mytest.backend.tools.a2ui.A2uiProtocol.obj;
import static com.mytest.backend.tools.a2ui.A2uiProtocol.repeatedChildren;
import static com.mytest.backend.tools.a2ui.A2uiProtocol.surface;

@Component
@Order(10)
@Slf4j
@RequiredArgsConstructor
public class CoffeeOrderTools implements A2uiToolProvider {

    public static final String TOOL_NAME = "coffeeOrder";
    public static final String TOOL_DESCRIPTION = "Create an interactive A2UI coffee order card. " +
            "Call this tool when the selected agent is asked to create, show, purchase, or add a coffee order, " +
            "or when the request mentions coffee, latte, oat milk latte, croissant, Sunrise Coffee, 咖啡, 拿铁, 购买咖啡, 咖啡订单. " +
            "The tool simulates menu items, randomized prices, randomized tax, total, and returns an A2UI v0.9 payload for the frontend to render. " +
            "Do not manually describe the card when this tool is available; call this tool instead.";

    private static final String CATALOG_ID = "https://local.a2ui.dev/catalogs/coffee-order/v1.json";
    private static final int MIN_DRINK_PRICE_CENTS = 495;
    private static final int MAX_DRINK_PRICE_CENTS = 795;
    private static final int MIN_PASTRY_PRICE_CENTS = 325;
    private static final int MAX_PASTRY_PRICE_CENTS = 575;
    private static final int MIN_TAX_RATE_PER_MILLE = 75;
    private static final int MAX_TAX_RATE_PER_MILLE = 96;

    private static final List<String> DRINK_DETAILS = List.of(
            "Grande, Extra Shot",
            "Tall, Oat Milk",
            "Iced, Vanilla",
            "Grande, Half Sweet"
    );
    private static final List<String> PASTRY_DETAILS = List.of(
            "Warmed",
            "Toasted",
            "Fresh from the case",
            "Lightly warmed"
    );

    private final A2uiResourceFactory a2ui;

    @Override
    public A2uiToolDefinition a2uiToolDefinition() {
        return new A2uiToolDefinition(
                TOOL_NAME,
                TOOL_DESCRIPTION,
                A2uiToolSchema.object()
                        .optionalString("customerName", "Optional customer name for the simulated coffee order.")
                        .optionalString("drinkName", "Optional drink request. Defaults to Oat Milk Latte.")
                        .optionalString("pastryName", "Optional pastry request. Defaults to Chocolate Croissant.")
                        .build(),
                arguments -> createCoffeeOrderA2uiResource(
                        optionalString(arguments, "customerName"),
                        optionalString(arguments, "drinkName"),
                        optionalString(arguments, "pastryName")
                )
        );
    }

    @Tool(
        name = TOOL_NAME,
        description = TOOL_DESCRIPTION,
        returnDirect = true
    )
    public String coffeeOrder(
            @ToolParam(required = false, description = "Optional customer name for the simulated coffee order.")
            String customerName,
            @ToolParam(required = false, description = "Optional drink request. Defaults to Oat Milk Latte.")
            String drinkName,
            @ToolParam(required = false, description = "Optional pastry request. Defaults to Chocolate Croissant.")
            String pastryName
    ) {
        A2uiResource resource = createCoffeeOrderA2uiResource(customerName, drinkName, pastryName);
        return a2ui.payloadJson(resource);
    }

    public A2uiResource createCoffeeOrderA2uiResource(
            String customerName,
            String drinkName,
            String pastryName
    ) {
        CoffeeOrder order = randomCoffeeOrder(customerName, drinkName, pastryName);
        List<Map<String, Object>> messages = buildA2uiMessages(order);
        String text = "Here is a Sunrise Coffee order card rendered from the coffeeOrder tool.";

        log.info(
                "Coffee order tool called, orderId: {}, customerName: {}, subtotal: {}, tax: {}, total: {}",
                order.orderId,
                order.customerName,
                order.subtotal,
                order.tax,
                order.total
        );
        return a2ui.create(
                text,
                "ui://coffee-order/" + order.orderId,
                messages
        );
    }

    private CoffeeOrder randomCoffeeOrder(String customerName, String drinkName, String pastryName) {
        ThreadLocalRandom random = ThreadLocalRandom.current();
        BigDecimal drinkPrice = randomMoney(
                MIN_DRINK_PRICE_CENTS,
                MAX_DRINK_PRICE_CENTS,
                random
        );
        BigDecimal pastryPrice = randomMoney(
                MIN_PASTRY_PRICE_CENTS,
                MAX_PASTRY_PRICE_CENTS,
                random
        );
        BigDecimal taxRate = BigDecimal.valueOf(
                random.nextInt(MIN_TAX_RATE_PER_MILLE, MAX_TAX_RATE_PER_MILLE + 1),
                3
        );
        BigDecimal subtotal = drinkPrice.add(pastryPrice).setScale(2, RoundingMode.HALF_UP);
        BigDecimal tax = subtotal.multiply(taxRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal total = subtotal.add(tax).setScale(2, RoundingMode.HALF_UP);
        String orderId = String.format(
                "sunrise-coffee-%s-%04d",
                Instant.now().toEpochMilli(),
                random.nextInt(1000, 10000)
        );

        return new CoffeeOrder(
                orderId,
                "coffee-order-" + orderId,
                normalize(customerName, "Guest"),
                normalize(drinkName, "Oat Milk Latte"),
                randomChoice(DRINK_DETAILS, random),
                drinkPrice,
                normalize(pastryName, "Chocolate Croissant"),
                randomChoice(PASTRY_DETAILS, random),
                pastryPrice,
                subtotal,
                tax,
                total
        );
    }

    private List<Map<String, Object>> buildA2uiMessages(CoffeeOrder order) {
        return surface(order.surfaceId, CATALOG_ID, buildComponents(), buildDataModel(order));
    }

    private List<Map<String, Object>> buildComponents() {
        return list(
                component(
                        "root",
                        "CoffeeOrderCard",
                        "children", List.of(
                                "coffee-order-header",
                                "coffee-order-items",
                                "coffee-order-divider",
                                "coffee-order-summary",
                                "coffee-order-actions"
                        )
                ),
                component(
                        "coffee-order-header",
                        "CoffeeOrderHeader",
                        "eyebrow", bind("/eyebrow"),
                        "shopName", bind("/shopName")
                ),
                component(
                        "coffee-order-items",
                        "CoffeeOrderItems",
                        "children", repeatedChildren("coffee-order-item-template", "/items")
                ),
                component(
                        "coffee-order-item-template",
                        "CoffeeOrderLineItem",
                        "name", bind("name"),
                        "detail", bind("detail"),
                        "price", bind("price")
                ),
                component("coffee-order-divider", "CoffeeOrderDivider"),
                component(
                        "coffee-order-summary",
                        "CoffeeOrderSummary",
                        "children", repeatedChildren("coffee-order-summary-row-template", "/summary")
                ),
                component(
                        "coffee-order-summary-row-template",
                        "CoffeeOrderSummaryRow",
                        "label", bind("label"),
                        "amount", bind("amount"),
                        "isTotal", bind("isTotal")
                ),
                component(
                        "coffee-order-actions",
                        "CoffeeOrderActions",
                        "purchaseLabel", bind("/actions/purchaseLabel"),
                        "cartLabel", bind("/actions/cartLabel"),
                        "purchaseAction", action("coffee_purchase", orderActionContext()),
                        "addToCartAction", action("coffee_add_to_cart", orderActionContext())
                )
        );
    }

    private Map<String, Object> buildDataModel(CoffeeOrder order) {
        return obj(
                "orderId", order.orderId,
                "customerName", order.customerName,
                "eyebrow", "Coffee Order",
                "shopName", "Sunrise Coffee",
                "items", List.of(
                        obj(
                                "name", order.drinkName,
                                "detail", order.drinkDetail,
                                "price", formatMoney(order.drinkPrice)
                        ),
                        obj(
                                "name", order.pastryName,
                                "detail", order.pastryDetail,
                                "price", formatMoney(order.pastryPrice)
                        )
                ),
                "summary", List.of(
                        obj(
                                "label", "Subtotal",
                                "amount", formatMoney(order.subtotal),
                                "isTotal", false
                        ),
                        obj(
                                "label", "Tax",
                                "amount", formatMoney(order.tax),
                                "isTotal", false
                        ),
                        obj(
                                "label", "Total",
                                "amount", formatMoney(order.total),
                                "isTotal", true
                        )
                ),
                "actions", obj(
                        "purchaseLabel", "Purchase",
                        "cartLabel", "Add to cart"
                )
        );
    }

    private Map<String, Object> orderActionContext() {
        return obj(
                "orderId", bind("/orderId"),
                "shopName", bind("/shopName"),
                "total", bind("/summary/2/amount")
        );
    }

    private static BigDecimal randomMoney(int minCents, int maxCents, ThreadLocalRandom random) {
        return BigDecimal.valueOf(random.nextInt(minCents, maxCents + 1), 2);
    }

    private static String randomChoice(List<String> values, ThreadLocalRandom random) {
        return values.get(random.nextInt(values.size()));
    }

    private static String normalize(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private static String formatMoney(BigDecimal value) {
        return "$" + value.setScale(2, RoundingMode.HALF_UP);
    }

    private static class CoffeeOrder {
        private final String orderId;
        private final String surfaceId;
        private final String customerName;
        private final String drinkName;
        private final String drinkDetail;
        private final BigDecimal drinkPrice;
        private final String pastryName;
        private final String pastryDetail;
        private final BigDecimal pastryPrice;
        private final BigDecimal subtotal;
        private final BigDecimal tax;
        private final BigDecimal total;

        private CoffeeOrder(
                String orderId,
                String surfaceId,
                String customerName,
                String drinkName,
                String drinkDetail,
                BigDecimal drinkPrice,
                String pastryName,
                String pastryDetail,
                BigDecimal pastryPrice,
                BigDecimal subtotal,
                BigDecimal tax,
                BigDecimal total
        ) {
            this.orderId = orderId;
            this.surfaceId = surfaceId;
            this.customerName = customerName;
            this.drinkName = drinkName;
            this.drinkDetail = drinkDetail;
            this.drinkPrice = drinkPrice;
            this.pastryName = pastryName;
            this.pastryDetail = pastryDetail;
            this.pastryPrice = pastryPrice;
            this.subtotal = subtotal;
            this.tax = tax;
            this.total = total;
        }
    }
}
