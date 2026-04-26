// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract SubscriptionManager is Ownable {
    using SafeERC20 for IERC20;

    struct Plan {
        uint256 price;
        uint256 interval;
        address tokenAddress;
        bool active;
    }

    struct Subscription {
        address subscriber;
        uint256 planId;
        uint256 nextRenewalAt;
        bool active;
        bool paused;
    }

    mapping(uint256 => Plan) public plans;
    mapping(uint256 => Subscription) public subscriptions;

    uint256 public subscriptionCount;
    address public treasury;

    event PlanCreated(uint256 indexed planId, uint256 price, uint256 interval, address indexed tokenAddress);
    event Subscribed(uint256 indexed subscriptionId, uint256 indexed planId, address indexed subscriber, uint256 nextRenewalAt);
    event Renewed(uint256 indexed subscriptionId, uint256 nextRenewalAt);
    event Paused(uint256 indexed subscriptionId);
    event Cancelled(uint256 indexed subscriptionId);

    constructor(address owner_, address treasury_) Ownable(owner_) {
        require(treasury_ != address(0), "Invalid treasury");
        treasury = treasury_;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        treasury = newTreasury;
    }

    function createPlan(uint256 planId, uint256 price, uint256 interval, address tokenAddress) external onlyOwner {
        require(planId > 0, "Invalid planId");
        require(price > 0, "Invalid price");
        require(interval > 0, "Invalid interval");
        require(tokenAddress != address(0), "Invalid token");
        require(!plans[planId].active, "Plan already exists");

        plans[planId] = Plan({
            price: price,
            interval: interval,
            tokenAddress: tokenAddress,
            active: true
        });

        emit PlanCreated(planId, price, interval, tokenAddress);
    }

    function subscribe(uint256 planId) external returns (uint256 subscriptionId) {
        Plan memory plan = plans[planId];
        require(plan.active, "Plan not active");

        IERC20(plan.tokenAddress).safeTransferFrom(msg.sender, treasury, plan.price);

        subscriptionCount += 1;
        subscriptionId = subscriptionCount;

        subscriptions[subscriptionId] = Subscription({
            subscriber: msg.sender,
            planId: planId,
            nextRenewalAt: block.timestamp + plan.interval,
            active: true,
            paused: false
        });

        emit Subscribed(subscriptionId, planId, msg.sender, block.timestamp + plan.interval);
    }

    function renew(uint256 subscriptionId) external {
        Subscription storage subscription = subscriptions[subscriptionId];
        require(subscription.active, "Subscription not active");
        require(!subscription.paused, "Subscription paused");
        require(subscription.subscriber == msg.sender, "Not subscriber");

        Plan memory plan = plans[subscription.planId];
        require(plan.active, "Plan not active");

        IERC20(plan.tokenAddress).safeTransferFrom(msg.sender, treasury, plan.price);

        uint256 baseTime = subscription.nextRenewalAt > block.timestamp
            ? subscription.nextRenewalAt
            : block.timestamp;
        subscription.nextRenewalAt = baseTime + plan.interval;

        emit Renewed(subscriptionId, subscription.nextRenewalAt);
    }

    function pause(uint256 subscriptionId) external {
        Subscription storage subscription = subscriptions[subscriptionId];
        require(subscription.subscriber == msg.sender, "Not subscriber");
        require(subscription.active, "Subscription not active");
        require(!subscription.paused, "Already paused");

        subscription.paused = true;
        emit Paused(subscriptionId);
    }

    function cancel(uint256 subscriptionId) external {
        Subscription storage subscription = subscriptions[subscriptionId];
        require(subscription.subscriber == msg.sender, "Not subscriber");
        require(subscription.active, "Already cancelled");

        subscription.active = false;
        subscription.paused = false;
        emit Cancelled(subscriptionId);
    }
}
