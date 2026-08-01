// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MilestoneEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint32 public constant MAX_MILESTONES = 10;

    enum ProjectStatus {
        Created,
        Funded,
        Active,
        Completed,
        Cancelled,
        Refunded
    }

    enum MilestoneStatus {
        Pending,
        Submitted,
        Paid
    }

    struct Project {
        address client;
        address freelancer;
        uint96 totalAmount;
        uint96 releasedAmount;
        uint64 createdAt;
        uint64 fundedAt;
        uint64 deadline;
        uint32 milestoneCount;
        ProjectStatus status;
        bytes32 metadataHash;
    }

    struct Milestone {
        uint96 amount;
        uint64 dueDate;
        MilestoneStatus status;
        bytes32 submissionHash;
    }

    IERC20 public immutable paymentToken;
    uint64 public immutable acceptancePeriod;
    uint256 public nextProjectId;

    mapping(uint256 projectId => Project) private _projects;
    mapping(uint256 projectId => mapping(uint256 milestoneId => Milestone)) private _milestones;

    error ZeroAddress();
    error SameParticipant();
    error InvalidAcceptancePeriod();
    error InvalidDeadline();
    error InvalidMilestoneCount();
    error InvalidMilestoneDeadline(uint256 milestoneId);
    error InvalidMilestoneAmount(uint256 milestoneId);
    error InvalidMetadataHash();
    error InvalidSubmissionHash();
    error AmountOverflow();
    error ProjectNotFound();
    error MilestoneNotFound();
    error Unauthorized();
    error InvalidProjectStatus(ProjectStatus expected, ProjectStatus actual);
    error InvalidMilestoneStatus();
    error AcceptancePeriodActive(uint64 refundableAt);
    error UnsupportedPaymentToken();

    event ProjectCreated(
        uint256 indexed projectId,
        address indexed client,
        address indexed freelancer,
        uint256 totalAmount,
        bytes32 metadataHash
    );
    event ProjectFunded(uint256 indexed projectId, uint256 amount, uint64 fundedAt);
    event ProjectAccepted(uint256 indexed projectId);
    event MilestoneSubmitted(uint256 indexed projectId, uint256 indexed milestoneId, bytes32 submissionHash);
    event MilestonePaid(
        uint256 indexed projectId,
        uint256 indexed milestoneId,
        address indexed freelancer,
        uint256 amount
    );
    event ProjectCompleted(uint256 indexed projectId);
    event ProjectCancelled(uint256 indexed projectId);
    event ProjectRefunded(uint256 indexed projectId, address indexed client, uint256 amount);

    constructor(address paymentToken_, uint64 acceptancePeriod_) {
        if (paymentToken_ == address(0)) revert ZeroAddress();
        if (paymentToken_.code.length == 0) revert UnsupportedPaymentToken();
        if (acceptancePeriod_ == 0) revert InvalidAcceptancePeriod();
        paymentToken = IERC20(paymentToken_);
        acceptancePeriod = acceptancePeriod_;
    }

    function createProject(
        address freelancer,
        uint64 deadline,
        bytes32 metadataHash,
        uint96[] calldata milestoneAmounts,
        uint64[] calldata milestoneDeadlines
    ) external returns (uint256 projectId) {
        if (freelancer == address(0)) revert ZeroAddress();
        if (freelancer == msg.sender) revert SameParticipant();
        if (deadline <= block.timestamp) revert InvalidDeadline();
        if (metadataHash == bytes32(0)) revert InvalidMetadataHash();

        uint256 count = milestoneAmounts.length;
        if (count == 0 || count > MAX_MILESTONES || count != milestoneDeadlines.length) {
            revert InvalidMilestoneCount();
        }

        uint256 total;
        projectId = nextProjectId++;
        for (uint256 milestoneId; milestoneId < count; ++milestoneId) {
            uint96 amount = milestoneAmounts[milestoneId];
            uint64 dueDate = milestoneDeadlines[milestoneId];
            if (amount == 0) revert InvalidMilestoneAmount(milestoneId);
            if (dueDate <= block.timestamp || dueDate > deadline) {
                revert InvalidMilestoneDeadline(milestoneId);
            }
            total += amount;
            _milestones[projectId][milestoneId] = Milestone({
                amount: amount,
                dueDate: dueDate,
                status: MilestoneStatus.Pending,
                submissionHash: bytes32(0)
            });
        }
        if (total > type(uint96).max) revert AmountOverflow();

        _projects[projectId] = Project({
            client: msg.sender,
            freelancer: freelancer,
            totalAmount: uint96(total),
            releasedAmount: 0,
            createdAt: uint64(block.timestamp),
            fundedAt: 0,
            deadline: deadline,
            milestoneCount: uint32(count),
            status: ProjectStatus.Created,
            metadataHash: metadataHash
        });

        emit ProjectCreated(projectId, msg.sender, freelancer, total, metadataHash);
    }

    function fundProject(uint256 projectId) external nonReentrant {
        Project storage project = _project(projectId);
        if (msg.sender != project.client) revert Unauthorized();
        _requireProjectStatus(project, ProjectStatus.Created);

        uint256 balanceBefore = paymentToken.balanceOf(address(this));
        paymentToken.safeTransferFrom(msg.sender, address(this), project.totalAmount);
        uint256 received = paymentToken.balanceOf(address(this)) - balanceBefore;
        if (received != project.totalAmount) revert UnsupportedPaymentToken();

        project.fundedAt = uint64(block.timestamp);
        project.status = ProjectStatus.Funded;
        emit ProjectFunded(projectId, project.totalAmount, project.fundedAt);
    }

    function acceptProject(uint256 projectId) external {
        Project storage project = _project(projectId);
        if (msg.sender != project.freelancer) revert Unauthorized();
        _requireProjectStatus(project, ProjectStatus.Funded);
        project.status = ProjectStatus.Active;
        emit ProjectAccepted(projectId);
    }

    function submitMilestone(uint256 projectId, uint256 milestoneId, bytes32 submissionHash) external {
        Project storage project = _project(projectId);
        if (msg.sender != project.freelancer) revert Unauthorized();
        _requireProjectStatus(project, ProjectStatus.Active);
        if (submissionHash == bytes32(0)) revert InvalidSubmissionHash();

        Milestone storage milestone = _milestone(project, projectId, milestoneId);
        if (milestone.status == MilestoneStatus.Paid) revert InvalidMilestoneStatus();
        milestone.submissionHash = submissionHash;
        milestone.status = MilestoneStatus.Submitted;
        emit MilestoneSubmitted(projectId, milestoneId, submissionHash);
    }

    function approveMilestone(uint256 projectId, uint256 milestoneId) external nonReentrant {
        Project storage project = _project(projectId);
        if (msg.sender != project.client) revert Unauthorized();
        _requireProjectStatus(project, ProjectStatus.Active);

        Milestone storage milestone = _milestone(project, projectId, milestoneId);
        if (milestone.status != MilestoneStatus.Submitted) revert InvalidMilestoneStatus();

        milestone.status = MilestoneStatus.Paid;
        project.releasedAmount += milestone.amount;
        if (project.releasedAmount == project.totalAmount) {
            project.status = ProjectStatus.Completed;
        }

        paymentToken.safeTransfer(project.freelancer, milestone.amount);
        emit MilestonePaid(projectId, milestoneId, project.freelancer, milestone.amount);
        if (project.status == ProjectStatus.Completed) emit ProjectCompleted(projectId);
    }

    function cancelProject(uint256 projectId) external {
        Project storage project = _project(projectId);
        if (msg.sender != project.client) revert Unauthorized();
        _requireProjectStatus(project, ProjectStatus.Created);
        project.status = ProjectStatus.Cancelled;
        emit ProjectCancelled(projectId);
    }

    function refundUnacceptedProject(uint256 projectId) external nonReentrant {
        Project storage project = _project(projectId);
        if (msg.sender != project.client) revert Unauthorized();
        _requireProjectStatus(project, ProjectStatus.Funded);

        uint64 refundableAt = project.fundedAt + acceptancePeriod;
        if (block.timestamp < refundableAt) revert AcceptancePeriodActive(refundableAt);

        project.status = ProjectStatus.Refunded;
        paymentToken.safeTransfer(project.client, project.totalAmount);
        emit ProjectRefunded(projectId, project.client, project.totalAmount);
    }

    function getProject(uint256 projectId) external view returns (Project memory) {
        return _project(projectId);
    }

    function getMilestone(uint256 projectId, uint256 milestoneId) external view returns (Milestone memory) {
        Project storage project = _project(projectId);
        return _milestone(project, projectId, milestoneId);
    }

    function _project(uint256 projectId) private view returns (Project storage project) {
        project = _projects[projectId];
        if (project.client == address(0)) revert ProjectNotFound();
    }

    function _milestone(
        Project storage project,
        uint256 projectId,
        uint256 milestoneId
    ) private view returns (Milestone storage milestone) {
        if (milestoneId >= project.milestoneCount) revert MilestoneNotFound();
        milestone = _milestones[projectId][milestoneId];
    }

    function _requireProjectStatus(Project storage project, ProjectStatus expected) private view {
        if (project.status != expected) revert InvalidProjectStatus(expected, project.status);
    }
}
