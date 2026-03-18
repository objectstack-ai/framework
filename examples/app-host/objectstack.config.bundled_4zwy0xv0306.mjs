var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../app-crm/src/interfaces/index.ts
var require_interfaces = __commonJS({
  "../app-crm/src/interfaces/index.ts"() {
    "use strict";
  }
});

// objectstack.config.ts
import { defineStack as defineStack4 } from "@objectstack/spec";
import { AppPlugin, DriverPlugin } from "@objectstack/runtime";
import { ObjectQLPlugin } from "@objectstack/objectql";
import { InMemoryDriver } from "@objectstack/driver-memory";
import { AuthPlugin } from "@objectstack/plugin-auth";

// ../app-crm/objectstack.config.ts
import { defineStack } from "@objectstack/spec";

// ../app-crm/src/objects/index.ts
var objects_exports = {};
__export(objects_exports, {
  Account: () => Account,
  Campaign: () => Campaign,
  Case: () => Case,
  Contact: () => Contact,
  Contract: () => Contract,
  Lead: () => Lead,
  Opportunity: () => Opportunity,
  Product: () => Product,
  Quote: () => Quote,
  Task: () => Task
});

// ../app-crm/src/objects/account.object.ts
import { ObjectSchema, Field } from "@objectstack/spec/data";
var Account = ObjectSchema.create({
  name: "account",
  label: "Account",
  pluralLabel: "Accounts",
  icon: "building",
  description: "Companies and organizations doing business with us",
  titleFormat: "{account_number} - {name}",
  compactLayout: ["account_number", "name", "type", "owner"],
  fields: {
    // AutoNumber field - Unique account identifier
    account_number: Field.autonumber({
      label: "Account Number",
      format: "ACC-{0000}"
    }),
    // Basic Information
    name: Field.text({
      label: "Account Name",
      required: true,
      searchable: true,
      maxLength: 255
    }),
    // Select fields with custom options
    type: Field.select({
      label: "Account Type",
      options: [
        { label: "Prospect", value: "prospect", color: "#FFA500", default: true },
        { label: "Customer", value: "customer", color: "#00AA00" },
        { label: "Partner", value: "partner", color: "#0000FF" },
        { label: "Former Customer", value: "former", color: "#999999" }
      ]
    }),
    industry: Field.select({
      label: "Industry",
      options: [
        { label: "Technology", value: "technology" },
        { label: "Finance", value: "finance" },
        { label: "Healthcare", value: "healthcare" },
        { label: "Retail", value: "retail" },
        { label: "Manufacturing", value: "manufacturing" },
        { label: "Education", value: "education" }
      ]
    }),
    // Number fields
    annual_revenue: Field.currency({
      label: "Annual Revenue",
      scale: 2,
      min: 0
    }),
    number_of_employees: Field.number({
      label: "Employees",
      min: 0
    }),
    // Contact Information
    phone: Field.text({
      label: "Phone",
      format: "phone"
    }),
    website: Field.url({
      label: "Website"
    }),
    // Structured Address field (new field type)
    billing_address: Field.address({
      label: "Billing Address",
      addressFormat: "international"
    }),
    // Office Location (new field type)
    office_location: Field.location({
      label: "Office Location",
      displayMap: true,
      allowGeocoding: true
    }),
    // Relationship fields
    owner: Field.lookup("user", {
      label: "Account Owner",
      required: true
    }),
    parent_account: Field.lookup("account", {
      label: "Parent Account",
      description: "Parent company in hierarchy"
    }),
    // Rich text field
    description: Field.markdown({
      label: "Description"
    }),
    // Boolean field
    is_active: Field.boolean({
      label: "Active",
      defaultValue: true
    }),
    // Date field
    last_activity_date: Field.date({
      label: "Last Activity Date",
      readonly: true
    }),
    // Brand color (new field type)
    brand_color: Field.color({
      label: "Brand Color",
      colorFormat: "hex",
      presetColors: ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"]
    })
  },
  // Database indexes for performance
  indexes: [
    { fields: ["name"], unique: false },
    { fields: ["owner"], unique: false },
    { fields: ["type", "is_active"], unique: false }
  ],
  // Enable advanced features
  enable: {
    trackHistory: true,
    // Track field changes
    searchable: true,
    // Include in global search
    apiEnabled: true,
    // Expose via REST/GraphQL
    apiMethods: ["get", "list", "create", "update", "delete", "search", "export"],
    // Whitelist allowed API operations
    files: true,
    // Allow file attachments
    feeds: true,
    // Enable activity feed/chatter (Chatter-like)
    activities: true,
    // Enable tasks and events tracking
    trash: true,
    // Recycle bin support
    mru: true
    // Track Most Recently Used
  },
  // Validation Rules
  validations: [
    {
      name: "revenue_positive",
      type: "script",
      severity: "error",
      message: "Annual Revenue must be positive",
      condition: "annual_revenue < 0"
    },
    {
      name: "account_name_unique",
      type: "unique",
      severity: "error",
      message: "Account name must be unique",
      fields: ["name"],
      caseSensitive: false
    }
  ],
  // Workflow Rules
  workflows: [
    {
      name: "update_last_activity",
      objectName: "account",
      triggerType: "on_update",
      criteria: "ISCHANGED(owner) OR ISCHANGED(type)",
      actions: [
        {
          name: "set_activity_date",
          type: "field_update",
          field: "last_activity_date",
          value: "TODAY()"
        }
      ],
      active: true
    }
  ]
});

// ../app-crm/src/objects/campaign.object.ts
import { ObjectSchema as ObjectSchema2, Field as Field2 } from "@objectstack/spec/data";
var Campaign = ObjectSchema2.create({
  name: "campaign",
  label: "Campaign",
  pluralLabel: "Campaigns",
  icon: "megaphone",
  description: "Marketing campaigns and initiatives",
  titleFormat: "{campaign_code} - {name}",
  compactLayout: ["campaign_code", "name", "type", "status", "start_date"],
  fields: {
    // AutoNumber field
    campaign_code: Field2.autonumber({
      label: "Campaign Code",
      format: "CPG-{0000}"
    }),
    // Basic Information
    name: Field2.text({
      label: "Campaign Name",
      required: true,
      searchable: true,
      maxLength: 255
    }),
    description: Field2.markdown({
      label: "Description"
    }),
    // Type & Channel
    type: Field2.select({
      label: "Campaign Type",
      options: [
        { label: "Email", value: "email", default: true },
        { label: "Webinar", value: "webinar" },
        { label: "Trade Show", value: "trade_show" },
        { label: "Conference", value: "conference" },
        { label: "Direct Mail", value: "direct_mail" },
        { label: "Social Media", value: "social_media" },
        { label: "Content Marketing", value: "content" },
        { label: "Partner Marketing", value: "partner" }
      ]
    }),
    channel: Field2.select({
      label: "Primary Channel",
      options: [
        { label: "Digital", value: "digital" },
        { label: "Social", value: "social" },
        { label: "Email", value: "email" },
        { label: "Events", value: "events" },
        { label: "Partner", value: "partner" }
      ]
    }),
    // Status
    status: Field2.select({
      label: "Status",
      options: [
        { label: "Planning", value: "planning", color: "#999999", default: true },
        { label: "In Progress", value: "in_progress", color: "#FFA500" },
        { label: "Completed", value: "completed", color: "#00AA00" },
        { label: "Aborted", value: "aborted", color: "#FF0000" }
      ],
      required: true
    }),
    // Dates
    start_date: Field2.date({
      label: "Start Date",
      required: true
    }),
    end_date: Field2.date({
      label: "End Date",
      required: true
    }),
    // Budget & ROI
    budgeted_cost: Field2.currency({
      label: "Budgeted Cost",
      scale: 2,
      min: 0
    }),
    actual_cost: Field2.currency({
      label: "Actual Cost",
      scale: 2,
      min: 0
    }),
    expected_revenue: Field2.currency({
      label: "Expected Revenue",
      scale: 2,
      min: 0
    }),
    actual_revenue: Field2.currency({
      label: "Actual Revenue",
      scale: 2,
      min: 0,
      readonly: true
    }),
    // Metrics
    target_size: Field2.number({
      label: "Target Size",
      description: "Target number of leads/contacts",
      min: 0
    }),
    num_sent: Field2.number({
      label: "Number Sent",
      min: 0,
      readonly: true
    }),
    num_responses: Field2.number({
      label: "Number of Responses",
      min: 0,
      readonly: true
    }),
    num_leads: Field2.number({
      label: "Number of Leads",
      min: 0,
      readonly: true
    }),
    num_converted_leads: Field2.number({
      label: "Converted Leads",
      min: 0,
      readonly: true
    }),
    num_opportunities: Field2.number({
      label: "Opportunities Created",
      min: 0,
      readonly: true
    }),
    num_won_opportunities: Field2.number({
      label: "Won Opportunities",
      min: 0,
      readonly: true
    }),
    // Calculated Metrics (Formula Fields)
    response_rate: Field2.formula({
      label: "Response Rate %",
      expression: "IF(num_sent > 0, (num_responses / num_sent) * 100, 0)",
      scale: 2
    }),
    roi: Field2.formula({
      label: "ROI %",
      expression: "IF(actual_cost > 0, ((actual_revenue - actual_cost) / actual_cost) * 100, 0)",
      scale: 2
    }),
    // Relationships
    parent_campaign: Field2.lookup("campaign", {
      label: "Parent Campaign",
      description: "Parent campaign in hierarchy"
    }),
    owner: Field2.lookup("user", {
      label: "Campaign Owner",
      required: true
    }),
    // Campaign Assets
    landing_page_url: Field2.url({
      label: "Landing Page"
    }),
    is_active: Field2.boolean({
      label: "Active",
      defaultValue: true
    })
  },
  // Database indexes
  indexes: [
    { fields: ["name"], unique: false },
    { fields: ["type"], unique: false },
    { fields: ["status"], unique: false },
    { fields: ["start_date"], unique: false },
    { fields: ["owner"], unique: false }
  ],
  // Enable advanced features
  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    apiMethods: ["get", "list", "create", "update", "delete", "search", "export"],
    files: true,
    feeds: true,
    activities: true,
    trash: true,
    mru: true
  },
  // Validation Rules
  validations: [
    {
      name: "end_after_start",
      type: "script",
      severity: "error",
      message: "End Date must be after Start Date",
      condition: "end_date < start_date"
    },
    {
      name: "actual_cost_within_budget",
      type: "script",
      severity: "warning",
      message: "Actual Cost exceeds Budgeted Cost",
      condition: "actual_cost > budgeted_cost"
    }
  ],
  // Workflow Rules
  workflows: [
    {
      name: "campaign_completion_check",
      objectName: "campaign",
      triggerType: "on_read",
      criteria: 'end_date < TODAY() AND status = "in_progress"',
      actions: [
        {
          name: "mark_completed",
          type: "field_update",
          field: "status",
          value: '"completed"'
        }
      ],
      active: true
    }
  ]
});

// ../app-crm/src/objects/case.object.ts
import { ObjectSchema as ObjectSchema3, Field as Field3 } from "@objectstack/spec/data";
var Case = ObjectSchema3.create({
  name: "case",
  label: "Case",
  pluralLabel: "Cases",
  icon: "life-buoy",
  description: "Customer support cases and service requests",
  fields: {
    // Case Information
    case_number: Field3.autonumber({
      label: "Case Number",
      format: "CASE-{00000}"
    }),
    subject: Field3.text({
      label: "Subject",
      required: true,
      searchable: true,
      maxLength: 255
    }),
    description: Field3.markdown({
      label: "Description",
      required: true
    }),
    // Relationships
    account: Field3.lookup("account", {
      label: "Account"
    }),
    contact: Field3.lookup("contact", {
      label: "Contact",
      required: true,
      referenceFilters: ["account = {case.account}"]
    }),
    // Case Management
    status: Field3.select({
      label: "Status",
      required: true,
      options: [
        { label: "New", value: "new", color: "#808080", default: true },
        { label: "In Progress", value: "in_progress", color: "#FFA500" },
        { label: "Waiting on Customer", value: "waiting_customer", color: "#FFD700" },
        { label: "Waiting on Support", value: "waiting_support", color: "#4169E1" },
        { label: "Escalated", value: "escalated", color: "#FF0000" },
        { label: "Resolved", value: "resolved", color: "#00AA00" },
        { label: "Closed", value: "closed", color: "#006400" }
      ]
    }),
    priority: Field3.select({
      label: "Priority",
      required: true,
      options: [
        { label: "Low", value: "low", color: "#4169E1", default: true },
        { label: "Medium", value: "medium", color: "#FFA500" },
        { label: "High", value: "high", color: "#FF4500" },
        { label: "Critical", value: "critical", color: "#FF0000" }
      ]
    }),
    type: Field3.select(["Question", "Problem", "Feature Request", "Bug"], {
      label: "Case Type"
    }),
    origin: Field3.select(["Email", "Phone", "Web", "Chat", "Social Media"], {
      label: "Case Origin"
    }),
    // Assignment
    owner: Field3.lookup("user", {
      label: "Case Owner",
      required: true
    }),
    // SLA and Metrics
    created_date: Field3.datetime({
      label: "Created Date",
      readonly: true
    }),
    closed_date: Field3.datetime({
      label: "Closed Date",
      readonly: true
    }),
    first_response_date: Field3.datetime({
      label: "First Response Date",
      readonly: true
    }),
    resolution_time_hours: Field3.number({
      label: "Resolution Time (Hours)",
      readonly: true,
      scale: 2
    }),
    sla_due_date: Field3.datetime({
      label: "SLA Due Date"
    }),
    is_sla_violated: Field3.boolean({
      label: "SLA Violated",
      defaultValue: false,
      readonly: true
    }),
    // Escalation
    is_escalated: Field3.boolean({
      label: "Escalated",
      defaultValue: false
    }),
    escalation_reason: Field3.textarea({
      label: "Escalation Reason"
    }),
    // Related case
    parent_case: Field3.lookup("case", {
      label: "Parent Case",
      description: "Related parent case"
    }),
    // Resolution
    resolution: Field3.markdown({
      label: "Resolution"
    }),
    // Customer satisfaction
    customer_rating: Field3.rating(5, {
      label: "Customer Satisfaction",
      description: "Customer satisfaction rating (1-5 stars)"
    }),
    customer_feedback: Field3.textarea({
      label: "Customer Feedback"
    }),
    // Customer signature (for case resolution acknowledgment)
    customer_signature: Field3.signature({
      label: "Customer Signature",
      description: "Digital signature acknowledging case resolution"
    }),
    // Internal notes
    internal_notes: Field3.markdown({
      label: "Internal Notes",
      description: "Internal notes not visible to customer"
    }),
    // Flags
    is_closed: Field3.boolean({
      label: "Is Closed",
      defaultValue: false,
      readonly: true
    })
  },
  // Database indexes for performance
  indexes: [
    { fields: ["case_number"], unique: true },
    { fields: ["account"], unique: false },
    { fields: ["owner"], unique: false },
    { fields: ["status"], unique: false },
    { fields: ["priority"], unique: false }
  ],
  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    files: true,
    feeds: true,
    // Enable social feed, comments, and mentions
    activities: true,
    // Enable tasks and events tracking
    trash: true,
    mru: true
    // Track Most Recently Used
  },
  titleFormat: "{case_number} - {subject}",
  compactLayout: ["case_number", "subject", "account", "status", "priority"],
  // Removed: list_views and form_views belong in UI configuration, not object definition
  validations: [
    {
      name: "resolution_required_for_closed",
      type: "script",
      severity: "error",
      message: "Resolution is required when closing a case",
      condition: 'status = "closed" AND ISBLANK(resolution)'
    },
    {
      name: "escalation_reason_required",
      type: "script",
      severity: "error",
      message: "Escalation reason is required when escalating a case",
      condition: "is_escalated = true AND ISBLANK(escalation_reason)"
    },
    {
      name: "case_status_progression",
      type: "state_machine",
      severity: "warning",
      message: "Invalid status transition",
      field: "status",
      transitions: {
        "new": ["in_progress", "waiting_customer", "closed"],
        "in_progress": ["waiting_customer", "waiting_support", "escalated", "resolved"],
        "waiting_customer": ["in_progress", "closed"],
        "waiting_support": ["in_progress", "escalated"],
        "escalated": ["in_progress", "resolved"],
        "resolved": ["closed", "in_progress"],
        // Can reopen
        "closed": ["in_progress"]
        // Can reopen
      }
    }
  ],
  workflows: [
    {
      name: "set_closed_flag",
      objectName: "case",
      triggerType: "on_create_or_update",
      criteria: "ISCHANGED(status)",
      active: true,
      actions: [
        {
          name: "update_closed_flag",
          type: "field_update",
          field: "is_closed",
          value: 'status = "closed"'
        }
      ]
    },
    {
      name: "set_closed_date",
      objectName: "case",
      triggerType: "on_update",
      criteria: 'ISCHANGED(status) AND status = "closed"',
      active: true,
      actions: [
        {
          name: "set_date",
          type: "field_update",
          field: "closed_date",
          value: "NOW()"
        }
      ]
    },
    {
      name: "calculate_resolution_time",
      objectName: "case",
      triggerType: "on_update",
      criteria: "ISCHANGED(closed_date) AND NOT(ISBLANK(closed_date))",
      active: true,
      actions: [
        {
          name: "calc_time",
          type: "field_update",
          field: "resolution_time_hours",
          value: "HOURS(created_date, closed_date)"
        }
      ]
    },
    {
      name: "notify_on_critical",
      objectName: "case",
      triggerType: "on_create_or_update",
      criteria: 'priority = "critical"',
      active: true,
      actions: [
        {
          name: "email_support_manager",
          type: "email_alert",
          template: "critical_case_alert",
          recipients: ["support_manager@example.com"]
        }
      ]
    },
    {
      name: "notify_on_escalation",
      objectName: "case",
      triggerType: "on_update",
      criteria: "ISCHANGED(is_escalated) AND is_escalated = true",
      active: true,
      actions: [
        {
          name: "email_escalation_team",
          type: "email_alert",
          template: "case_escalation_alert",
          recipients: ["escalation_team@example.com"]
        }
      ]
    }
  ]
});

// ../app-crm/src/objects/contact.object.ts
import { ObjectSchema as ObjectSchema4, Field as Field4 } from "@objectstack/spec/data";
var Contact = ObjectSchema4.create({
  name: "contact",
  label: "Contact",
  pluralLabel: "Contacts",
  icon: "user",
  description: "People associated with accounts",
  fields: {
    // Name fields
    salutation: Field4.select(["Mr.", "Ms.", "Mrs.", "Dr.", "Prof."], {
      label: "Salutation"
    }),
    first_name: Field4.text({
      label: "First Name",
      required: true,
      searchable: true
    }),
    last_name: Field4.text({
      label: "Last Name",
      required: true,
      searchable: true
    }),
    // Formula field - Full name
    full_name: Field4.formula({
      label: "Full Name",
      expression: 'CONCAT(salutation, " ", first_name, " ", last_name)'
    }),
    // Relationship: Link to Account (Master-Detail)
    account: Field4.masterDetail("account", {
      label: "Account",
      required: true,
      writeRequiresMasterRead: true,
      deleteBehavior: "cascade"
      // Delete contacts when account is deleted
    }),
    // Contact Information
    email: Field4.email({
      label: "Email",
      required: true,
      unique: true
    }),
    phone: Field4.text({
      label: "Phone",
      format: "phone"
    }),
    mobile: Field4.text({
      label: "Mobile",
      format: "phone"
    }),
    // Professional Information
    title: Field4.text({
      label: "Job Title"
    }),
    department: Field4.select(["Executive", "Sales", "Marketing", "Engineering", "Support", "Finance", "HR", "Operations"], {
      label: "Department"
    }),
    // Relationship fields
    reports_to: Field4.lookup("contact", {
      label: "Reports To",
      description: "Direct manager/supervisor"
    }),
    owner: Field4.lookup("user", {
      label: "Contact Owner",
      required: true
    }),
    // Mailing Address
    mailing_street: Field4.textarea({ label: "Mailing Street" }),
    mailing_city: Field4.text({ label: "Mailing City" }),
    mailing_state: Field4.text({ label: "Mailing State/Province" }),
    mailing_postal_code: Field4.text({ label: "Mailing Postal Code" }),
    mailing_country: Field4.text({ label: "Mailing Country" }),
    // Additional Information
    birthdate: Field4.date({
      label: "Birthdate"
    }),
    lead_source: Field4.select(["Web", "Referral", "Event", "Partner", "Advertisement"], {
      label: "Lead Source"
    }),
    description: Field4.markdown({
      label: "Description"
    }),
    // Flags
    is_primary: Field4.boolean({
      label: "Primary Contact",
      defaultValue: false,
      description: "Is this the main contact for the account?"
    }),
    do_not_call: Field4.boolean({
      label: "Do Not Call",
      defaultValue: false
    }),
    email_opt_out: Field4.boolean({
      label: "Email Opt Out",
      defaultValue: false
    }),
    // Avatar field
    avatar: Field4.avatar({
      label: "Profile Picture"
    })
  },
  // Enable features
  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    files: true,
    feeds: true,
    // Enable social feed, comments, and mentions
    activities: true,
    // Enable tasks and events tracking
    trash: true,
    mru: true
    // Track Most Recently Used
  },
  // Display configuration
  titleFormat: "{full_name}",
  compactLayout: ["full_name", "email", "account", "phone"],
  // Validation Rules
  validations: [
    {
      name: "email_required_for_opt_in",
      type: "script",
      severity: "error",
      message: "Email is required when Email Opt Out is not checked",
      condition: "email_opt_out = false AND ISBLANK(email)"
    },
    {
      name: "email_unique_per_account",
      type: "unique",
      severity: "error",
      message: "Email must be unique within an account",
      fields: ["email", "account"],
      caseSensitive: false
    }
  ],
  // Workflow Rules
  workflows: [
    {
      name: "welcome_email",
      objectName: "contact",
      triggerType: "on_create",
      active: true,
      actions: [
        {
          name: "send_welcome",
          type: "email_alert",
          template: "contact_welcome",
          recipients: ["{contact.email}"]
        }
      ]
    }
  ]
});

// ../app-crm/src/objects/contract.object.ts
import { ObjectSchema as ObjectSchema5, Field as Field5 } from "@objectstack/spec/data";
var Contract = ObjectSchema5.create({
  name: "contract",
  label: "Contract",
  pluralLabel: "Contracts",
  icon: "file-signature",
  description: "Legal contracts and agreements",
  titleFormat: "{contract_number} - {account.name}",
  compactLayout: ["contract_number", "account", "status", "start_date", "end_date"],
  fields: {
    // AutoNumber field
    contract_number: Field5.autonumber({
      label: "Contract Number",
      format: "CTR-{0000}"
    }),
    // Relationships
    account: Field5.lookup("account", {
      label: "Account",
      required: true
    }),
    contact: Field5.lookup("contact", {
      label: "Primary Contact",
      required: true,
      referenceFilters: [
        "account = {account}"
      ]
    }),
    opportunity: Field5.lookup("opportunity", {
      label: "Related Opportunity",
      referenceFilters: [
        "account = {account}"
      ]
    }),
    owner: Field5.lookup("user", {
      label: "Contract Owner",
      required: true
    }),
    // Status
    status: Field5.select({
      label: "Status",
      options: [
        { label: "Draft", value: "draft", color: "#999999", default: true },
        { label: "In Approval", value: "in_approval", color: "#FFA500" },
        { label: "Activated", value: "activated", color: "#00AA00" },
        { label: "Expired", value: "expired", color: "#FF0000" },
        { label: "Terminated", value: "terminated", color: "#666666" }
      ],
      required: true
    }),
    // Contract Terms
    contract_term_months: Field5.number({
      label: "Contract Term (Months)",
      required: true,
      min: 1
    }),
    start_date: Field5.date({
      label: "Start Date",
      required: true
    }),
    end_date: Field5.date({
      label: "End Date",
      required: true
    }),
    // Financial
    contract_value: Field5.currency({
      label: "Contract Value",
      scale: 2,
      min: 0,
      required: true
    }),
    billing_frequency: Field5.select({
      label: "Billing Frequency",
      options: [
        { label: "Monthly", value: "monthly", default: true },
        { label: "Quarterly", value: "quarterly" },
        { label: "Annually", value: "annually" },
        { label: "One-time", value: "one_time" }
      ]
    }),
    payment_terms: Field5.select({
      label: "Payment Terms",
      options: [
        { label: "Net 15", value: "net_15" },
        { label: "Net 30", value: "net_30", default: true },
        { label: "Net 60", value: "net_60" },
        { label: "Net 90", value: "net_90" }
      ]
    }),
    // Renewal
    auto_renewal: Field5.boolean({
      label: "Auto Renewal",
      defaultValue: false
    }),
    renewal_notice_days: Field5.number({
      label: "Renewal Notice (Days)",
      min: 0,
      defaultValue: 30
    }),
    // Legal
    contract_type: Field5.select({
      label: "Contract Type",
      options: [
        { label: "Subscription", value: "subscription" },
        { label: "Service Agreement", value: "service" },
        { label: "License", value: "license" },
        { label: "Partnership", value: "partnership" },
        { label: "NDA", value: "nda" },
        { label: "MSA", value: "msa" }
      ]
    }),
    signed_date: Field5.date({
      label: "Signed Date"
    }),
    signed_by: Field5.text({
      label: "Signed By",
      maxLength: 255
    }),
    document_url: Field5.url({
      label: "Contract Document"
    }),
    // Terms & Conditions
    special_terms: Field5.markdown({
      label: "Special Terms"
    }),
    description: Field5.markdown({
      label: "Description"
    }),
    // Billing Address
    billing_address: Field5.address({
      label: "Billing Address",
      addressFormat: "international"
    })
  },
  // Database indexes
  indexes: [
    { fields: ["account"], unique: false },
    { fields: ["status"], unique: false },
    { fields: ["start_date"], unique: false },
    { fields: ["end_date"], unique: false },
    { fields: ["owner"], unique: false }
  ],
  // Enable advanced features
  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    apiMethods: ["get", "list", "create", "update", "delete", "search", "export"],
    files: true,
    feeds: true,
    activities: true,
    trash: true,
    mru: true
  },
  // Validation Rules
  validations: [
    {
      name: "end_after_start",
      type: "script",
      severity: "error",
      message: "End Date must be after Start Date",
      condition: "end_date <= start_date"
    },
    {
      name: "valid_contract_term",
      type: "script",
      severity: "error",
      message: "Contract Term must match date range",
      condition: "MONTH_DIFF(end_date, start_date) != contract_term_months"
    }
  ],
  // Workflow Rules
  workflows: [
    {
      name: "contract_expiration_check",
      objectName: "contract",
      triggerType: "scheduled",
      schedule: "0 0 * * *",
      // Daily at midnight
      criteria: 'end_date <= TODAY() AND status = "activated"',
      actions: [
        {
          name: "mark_expired",
          type: "field_update",
          field: "status",
          value: '"expired"'
        },
        {
          name: "notify_owner",
          type: "email_alert",
          template: "contract_expired",
          recipients: ["{owner}"]
        }
      ],
      active: true
    },
    {
      name: "renewal_reminder",
      objectName: "contract",
      triggerType: "scheduled",
      schedule: "0 0 * * *",
      // Daily at midnight
      criteria: 'DAYS_UNTIL(end_date) <= renewal_notice_days AND status = "activated"',
      actions: [
        {
          name: "notify_renewal",
          type: "email_alert",
          template: "contract_renewal_reminder",
          recipients: ["{owner}", "{account.owner}"]
        }
      ],
      active: true
    }
  ]
});

// ../app-crm/src/objects/lead.object.ts
import { ObjectSchema as ObjectSchema6, Field as Field6 } from "@objectstack/spec/data";

// ../app-crm/src/objects/lead.state.ts
var LeadStateMachine = {
  id: "lead_process",
  initial: "new",
  states: {
    new: {
      on: {
        CONTACT: { target: "contacted", description: "Log initial contact" },
        DISQUALIFY: { target: "unqualified", description: "Mark as unqualified early" }
      },
      meta: {
        aiInstructions: "New lead. Verify email and phone before contacting. Do not change status until contact is made."
      }
    },
    contacted: {
      on: {
        QUALIFY: { target: "qualified", cond: "has_budget_and_authority" },
        DISQUALIFY: { target: "unqualified" }
      },
      meta: {
        aiInstructions: "Engage with the lead. Qualify by asking about budget, authority, need, and timeline (BANT)."
      }
    },
    qualified: {
      on: {
        CONVERT: { target: "converted", cond: "is_ready_to_buy" },
        DISQUALIFY: { target: "unqualified" }
      },
      meta: {
        aiInstructions: "Lead is qualified. Prepare for conversion to Deal/Opportunity. Check for existing accounts."
      }
    },
    unqualified: {
      on: {
        REOPEN: { target: "new", description: "Re-evaluate lead" }
      },
      meta: {
        aiInstructions: "Lead is dead. Do not contact unless new information surfaces."
      }
    },
    converted: {
      type: "final",
      meta: {
        aiInstructions: "Lead is converted. No further actions allowed on this record."
      }
    }
  }
};

// ../app-crm/src/objects/lead.object.ts
var Lead = ObjectSchema6.create({
  name: "lead",
  label: "Lead",
  pluralLabel: "Leads",
  icon: "user-plus",
  description: "Potential customers not yet qualified",
  fields: {
    // Personal Information
    salutation: Field6.select(["Mr.", "Ms.", "Mrs.", "Dr."], {
      label: "Salutation"
    }),
    first_name: Field6.text({
      label: "First Name",
      required: true,
      searchable: true
    }),
    last_name: Field6.text({
      label: "Last Name",
      required: true,
      searchable: true
    }),
    full_name: Field6.formula({
      label: "Full Name",
      expression: 'CONCAT(salutation, " ", first_name, " ", last_name)'
    }),
    // Company Information
    company: Field6.text({
      label: "Company",
      required: true,
      searchable: true
    }),
    title: Field6.text({
      label: "Job Title"
    }),
    industry: Field6.select(["Technology", "Finance", "Healthcare", "Retail", "Manufacturing", "Education"], {
      label: "Industry"
    }),
    // Contact Information
    email: Field6.email({
      label: "Email",
      required: true,
      unique: true
    }),
    phone: Field6.text({
      label: "Phone",
      format: "phone"
    }),
    mobile: Field6.text({
      label: "Mobile",
      format: "phone"
    }),
    website: Field6.url({
      label: "Website"
    }),
    // Lead Qualification
    status: Field6.select({
      label: "Lead Status",
      required: true,
      options: [
        { label: "New", value: "new", color: "#808080", default: true },
        { label: "Contacted", value: "contacted", color: "#FFA500" },
        { label: "Qualified", value: "qualified", color: "#4169E1" },
        { label: "Unqualified", value: "unqualified", color: "#FF0000" },
        { label: "Converted", value: "converted", color: "#00AA00" }
      ]
    }),
    rating: Field6.rating(5, {
      label: "Lead Score",
      description: "Lead quality score (1-5 stars)",
      allowHalf: true
    }),
    lead_source: Field6.select(["Web", "Referral", "Event", "Partner", "Advertisement", "Cold Call"], {
      label: "Lead Source"
    }),
    // Assignment
    owner: Field6.lookup("user", {
      label: "Lead Owner",
      required: true
    }),
    // Conversion tracking
    is_converted: Field6.boolean({
      label: "Converted",
      defaultValue: false,
      readonly: true
    }),
    converted_account: Field6.lookup("account", {
      label: "Converted Account",
      readonly: true
    }),
    converted_contact: Field6.lookup("contact", {
      label: "Converted Contact",
      readonly: true
    }),
    converted_opportunity: Field6.lookup("opportunity", {
      label: "Converted Opportunity",
      readonly: true
    }),
    converted_date: Field6.datetime({
      label: "Converted Date",
      readonly: true
    }),
    // Address (using new address field type)
    address: Field6.address({
      label: "Address",
      addressFormat: "international"
    }),
    // Additional Info
    annual_revenue: Field6.currency({
      label: "Annual Revenue",
      scale: 2
    }),
    number_of_employees: Field6.number({
      label: "Number of Employees"
    }),
    description: Field6.markdown({
      label: "Description"
    }),
    // Custom notes with rich text formatting
    notes: Field6.richtext({
      label: "Notes",
      description: "Rich text notes with formatting"
    }),
    // Flags
    do_not_call: Field6.boolean({
      label: "Do Not Call",
      defaultValue: false
    }),
    email_opt_out: Field6.boolean({
      label: "Email Opt Out",
      defaultValue: false
    })
  },
  // Lifecycle State Machine(s)
  // Enforces valid status transitions to prevent AI hallucinations
  // Using `stateMachines` (plural) for future extensibility.
  // For simple objects with one lifecycle, `stateMachine` (singular) is also supported.
  stateMachines: {
    lifecycle: LeadStateMachine
  },
  // Database indexes for performance
  indexes: [
    { fields: ["email"], unique: true },
    { fields: ["owner"], unique: false },
    { fields: ["status"], unique: false },
    { fields: ["company"], unique: false }
  ],
  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    files: true,
    feeds: true,
    // Enable social feed, comments, and mentions
    activities: true,
    // Enable tasks and events tracking
    trash: true,
    mru: true
    // Track Most Recently Used
  },
  titleFormat: "{full_name} - {company}",
  compactLayout: ["full_name", "company", "email", "status", "owner"],
  // Removed: list_views and form_views belong in UI configuration, not object definition
  validations: [
    {
      name: "email_required",
      type: "script",
      severity: "error",
      message: "Email is required",
      condition: "ISBLANK(email)"
    },
    {
      name: "cannot_edit_converted",
      type: "script",
      severity: "error",
      message: "Cannot edit a converted lead",
      condition: "is_converted = true AND ISCHANGED(company, email, first_name, last_name)"
    }
  ],
  workflows: [
    {
      name: "auto_qualify_high_score_leads",
      objectName: "lead",
      triggerType: "on_create_or_update",
      criteria: 'rating >= 4 AND status = "new"',
      active: true,
      actions: [
        {
          name: "set_status",
          type: "field_update",
          field: "status",
          value: "contacted"
        }
      ]
    },
    {
      name: "notify_owner_on_high_score_lead",
      objectName: "lead",
      triggerType: "on_create_or_update",
      criteria: "ISCHANGED(rating) AND rating >= 4.5",
      active: true,
      actions: [
        {
          name: "email_owner",
          type: "email_alert",
          template: "high_score_lead_notification",
          recipients: ["{owner.email}"]
        }
      ]
    }
  ]
});

// ../app-crm/src/objects/opportunity.object.ts
import { ObjectSchema as ObjectSchema7, Field as Field7 } from "@objectstack/spec/data";
var Opportunity = ObjectSchema7.create({
  name: "opportunity",
  label: "Opportunity",
  pluralLabel: "Opportunities",
  icon: "dollar-sign",
  description: "Sales opportunities and deals in the pipeline",
  titleFormat: "{name} - {stage}",
  compactLayout: ["name", "account", "amount", "stage", "owner"],
  fields: {
    // Basic Information
    name: Field7.text({
      label: "Opportunity Name",
      required: true,
      searchable: true
    }),
    // Relationships
    account: Field7.lookup("account", {
      label: "Account",
      required: true
    }),
    primary_contact: Field7.lookup("contact", {
      label: "Primary Contact",
      referenceFilters: ["account = {opportunity.account}"]
      // Filter contacts by account
    }),
    owner: Field7.lookup("user", {
      label: "Opportunity Owner",
      required: true
    }),
    // Financial Information
    amount: Field7.currency({
      label: "Amount",
      required: true,
      scale: 2,
      min: 0
    }),
    expected_revenue: Field7.currency({
      label: "Expected Revenue",
      scale: 2,
      readonly: true
      // Calculated field
    }),
    // Sales Process
    stage: Field7.select({
      label: "Stage",
      required: true,
      options: [
        { label: "Prospecting", value: "prospecting", color: "#808080", default: true },
        { label: "Qualification", value: "qualification", color: "#FFA500" },
        { label: "Needs Analysis", value: "needs_analysis", color: "#FFD700" },
        { label: "Proposal", value: "proposal", color: "#4169E1" },
        { label: "Negotiation", value: "negotiation", color: "#9370DB" },
        { label: "Closed Won", value: "closed_won", color: "#00AA00" },
        { label: "Closed Lost", value: "closed_lost", color: "#FF0000" }
      ]
    }),
    probability: Field7.percent({
      label: "Probability (%)",
      min: 0,
      max: 100,
      defaultValue: 10
    }),
    // Important Dates
    close_date: Field7.date({
      label: "Close Date",
      required: true
    }),
    created_date: Field7.datetime({
      label: "Created Date",
      readonly: true
    }),
    // Additional Classification
    type: Field7.select(["New Business", "Existing Customer - Upgrade", "Existing Customer - Renewal", "Existing Customer - Expansion"], {
      label: "Opportunity Type"
    }),
    lead_source: Field7.select(["Web", "Referral", "Event", "Partner", "Advertisement", "Cold Call"], {
      label: "Lead Source"
    }),
    // Competitor Analysis
    competitors: Field7.select(["Competitor A", "Competitor B", "Competitor C"], {
      label: "Competitors",
      multiple: true
    }),
    // Campaign tracking
    campaign: Field7.lookup("campaign", {
      label: "Campaign",
      description: "Marketing campaign that generated this opportunity"
    }),
    // Sales cycle metrics
    days_in_stage: Field7.number({
      label: "Days in Current Stage",
      readonly: true
    }),
    // Additional information
    description: Field7.markdown({
      label: "Description"
    }),
    next_step: Field7.textarea({
      label: "Next Steps"
    }),
    // Flags
    is_private: Field7.boolean({
      label: "Private",
      defaultValue: false
    }),
    forecast_category: Field7.select(["Pipeline", "Best Case", "Commit", "Omitted", "Closed"], {
      label: "Forecast Category"
    })
  },
  // Database indexes for performance
  indexes: [
    { fields: ["name"], unique: false },
    { fields: ["account"], unique: false },
    { fields: ["owner"], unique: false },
    { fields: ["stage"], unique: false },
    { fields: ["close_date"], unique: false }
  ],
  // Enable advanced features
  enable: {
    trackHistory: true,
    // Critical for tracking stage changes
    searchable: true,
    apiEnabled: true,
    apiMethods: ["get", "list", "create", "update", "delete", "aggregate", "search"],
    // Whitelist allowed API operations
    files: true,
    // Attach proposals, contracts
    feeds: true,
    // Team collaboration (Chatter-like)
    activities: true,
    // Enable tasks and events tracking
    trash: true,
    mru: true
    // Track Most Recently Used
  },
  // Removed: list_views and form_views belong in UI configuration, not object definition
  // Validation Rules
  validations: [
    {
      name: "close_date_future",
      type: "script",
      severity: "warning",
      message: "Close date should not be in the past unless opportunity is closed",
      condition: 'close_date < TODAY() AND stage != "closed_won" AND stage != "closed_lost"'
    },
    {
      name: "amount_positive",
      type: "script",
      severity: "error",
      message: "Amount must be greater than zero",
      condition: "amount <= 0"
    },
    {
      name: "stage_progression",
      type: "state_machine",
      severity: "error",
      message: "Invalid stage transition",
      field: "stage",
      transitions: {
        "prospecting": ["qualification", "closed_lost"],
        "qualification": ["needs_analysis", "closed_lost"],
        "needs_analysis": ["proposal", "closed_lost"],
        "proposal": ["negotiation", "closed_lost"],
        "negotiation": ["closed_won", "closed_lost"],
        "closed_won": [],
        // Terminal state
        "closed_lost": []
        // Terminal state
      }
    }
  ],
  // Workflow Rules
  workflows: [
    {
      name: "update_probability_by_stage",
      objectName: "opportunity",
      triggerType: "on_create_or_update",
      criteria: "ISCHANGED(stage)",
      active: true,
      actions: [
        {
          name: "set_probability",
          type: "field_update",
          field: "probability",
          value: `CASE(stage,
            "prospecting", 10,
            "qualification", 25,
            "needs_analysis", 40,
            "proposal", 60,
            "negotiation", 80,
            "closed_won", 100,
            "closed_lost", 0,
            probability
          )`
        },
        {
          name: "set_forecast_category",
          type: "field_update",
          field: "forecast_category",
          value: `CASE(stage,
            "prospecting", "pipeline",
            "qualification", "pipeline",
            "needs_analysis", "best_case",
            "proposal", "commit",
            "negotiation", "commit",
            "closed_won", "closed",
            "closed_lost", "omitted",
            forecast_category
          )`
        }
      ]
    },
    {
      name: "calculate_expected_revenue",
      objectName: "opportunity",
      triggerType: "on_create_or_update",
      criteria: "ISCHANGED(amount) OR ISCHANGED(probability)",
      active: true,
      actions: [
        {
          name: "update_expected_revenue",
          type: "field_update",
          field: "expected_revenue",
          value: "amount * (probability / 100)"
        }
      ]
    },
    {
      name: "notify_on_large_deal_won",
      objectName: "opportunity",
      triggerType: "on_update",
      criteria: 'ISCHANGED(stage) AND stage = "closed_won" AND amount > 100000',
      active: true,
      actions: [
        {
          name: "notify_management",
          type: "email_alert",
          template: "large_deal_won",
          recipients: ["sales_management@example.com"]
        }
      ]
    }
  ]
});

// ../app-crm/src/objects/product.object.ts
import { ObjectSchema as ObjectSchema8, Field as Field8 } from "@objectstack/spec/data";
var Product = ObjectSchema8.create({
  name: "product",
  label: "Product",
  pluralLabel: "Products",
  icon: "box",
  description: "Products and services offered by the company",
  titleFormat: "{product_code} - {name}",
  compactLayout: ["product_code", "name", "category", "is_active"],
  fields: {
    // AutoNumber field - Unique product identifier
    product_code: Field8.autonumber({
      label: "Product Code",
      format: "PRD-{0000}"
    }),
    // Basic Information
    name: Field8.text({
      label: "Product Name",
      required: true,
      searchable: true,
      maxLength: 255
    }),
    description: Field8.markdown({
      label: "Description"
    }),
    // Categorization
    category: Field8.select({
      label: "Category",
      options: [
        { label: "Software", value: "software", default: true },
        { label: "Hardware", value: "hardware" },
        { label: "Service", value: "service" },
        { label: "Subscription", value: "subscription" },
        { label: "Support", value: "support" }
      ]
    }),
    family: Field8.select({
      label: "Product Family",
      options: [
        { label: "Enterprise Solutions", value: "enterprise" },
        { label: "SMB Solutions", value: "smb" },
        { label: "Professional Services", value: "services" },
        { label: "Cloud Services", value: "cloud" }
      ]
    }),
    // Pricing
    list_price: Field8.currency({
      label: "List Price",
      scale: 2,
      min: 0,
      required: true
    }),
    cost: Field8.currency({
      label: "Cost",
      scale: 2,
      min: 0
    }),
    // SKU and Inventory
    sku: Field8.text({
      label: "SKU",
      maxLength: 50,
      unique: true
    }),
    quantity_on_hand: Field8.number({
      label: "Quantity on Hand",
      min: 0,
      defaultValue: 0
    }),
    reorder_point: Field8.number({
      label: "Reorder Point",
      min: 0
    }),
    // Status
    is_active: Field8.boolean({
      label: "Active",
      defaultValue: true
    }),
    is_taxable: Field8.boolean({
      label: "Taxable",
      defaultValue: true
    }),
    // Relationships
    product_manager: Field8.lookup("user", {
      label: "Product Manager"
    }),
    // Images and Assets
    image_url: Field8.url({
      label: "Product Image"
    }),
    datasheet_url: Field8.url({
      label: "Datasheet URL"
    })
  },
  // Database indexes
  indexes: [
    { fields: ["name"], unique: false },
    { fields: ["sku"], unique: true },
    { fields: ["category"], unique: false },
    { fields: ["is_active"], unique: false }
  ],
  // Enable advanced features
  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    apiMethods: ["get", "list", "create", "update", "delete", "search"],
    files: true,
    feeds: true,
    trash: true,
    mru: true
  },
  // Validation Rules
  validations: [
    {
      name: "price_positive",
      type: "script",
      severity: "error",
      message: "List Price must be positive",
      condition: "list_price < 0"
    },
    {
      name: "cost_less_than_price",
      type: "script",
      severity: "warning",
      message: "Cost should be less than List Price",
      condition: "cost >= list_price"
    }
  ]
});

// ../app-crm/src/objects/quote.object.ts
import { ObjectSchema as ObjectSchema9, Field as Field9 } from "@objectstack/spec/data";
var Quote = ObjectSchema9.create({
  name: "quote",
  label: "Quote",
  pluralLabel: "Quotes",
  icon: "file-text",
  description: "Price quotes for customers",
  titleFormat: "{quote_number} - {name}",
  compactLayout: ["quote_number", "name", "account", "status", "total_price"],
  fields: {
    // AutoNumber field
    quote_number: Field9.autonumber({
      label: "Quote Number",
      format: "QTE-{0000}"
    }),
    // Basic Information
    name: Field9.text({
      label: "Quote Name",
      required: true,
      searchable: true,
      maxLength: 255
    }),
    // Relationships
    account: Field9.lookup("account", {
      label: "Account",
      required: true
    }),
    contact: Field9.lookup("contact", {
      label: "Contact",
      required: true,
      referenceFilters: [
        "account = {account}"
      ]
    }),
    opportunity: Field9.lookup("opportunity", {
      label: "Opportunity",
      referenceFilters: [
        "account = {account}"
      ]
    }),
    owner: Field9.lookup("user", {
      label: "Quote Owner",
      required: true
    }),
    // Status
    status: Field9.select({
      label: "Status",
      options: [
        { label: "Draft", value: "draft", color: "#999999", default: true },
        { label: "In Review", value: "in_review", color: "#FFA500" },
        { label: "Presented", value: "presented", color: "#4169E1" },
        { label: "Accepted", value: "accepted", color: "#00AA00" },
        { label: "Rejected", value: "rejected", color: "#FF0000" },
        { label: "Expired", value: "expired", color: "#666666" }
      ],
      required: true
    }),
    // Dates
    quote_date: Field9.date({
      label: "Quote Date",
      required: true,
      defaultValue: "TODAY()"
    }),
    expiration_date: Field9.date({
      label: "Expiration Date",
      required: true
    }),
    // Pricing
    subtotal: Field9.currency({
      label: "Subtotal",
      scale: 2,
      readonly: true
    }),
    discount: Field9.percent({
      label: "Discount %",
      scale: 2,
      min: 0,
      max: 100
    }),
    discount_amount: Field9.currency({
      label: "Discount Amount",
      scale: 2,
      readonly: true
    }),
    tax: Field9.currency({
      label: "Tax",
      scale: 2
    }),
    shipping_handling: Field9.currency({
      label: "Shipping & Handling",
      scale: 2
    }),
    total_price: Field9.currency({
      label: "Total Price",
      scale: 2,
      readonly: true
    }),
    // Terms
    payment_terms: Field9.select({
      label: "Payment Terms",
      options: [
        { label: "Net 15", value: "net_15" },
        { label: "Net 30", value: "net_30", default: true },
        { label: "Net 60", value: "net_60" },
        { label: "Net 90", value: "net_90" },
        { label: "Due on Receipt", value: "due_on_receipt" }
      ]
    }),
    shipping_terms: Field9.text({
      label: "Shipping Terms",
      maxLength: 255
    }),
    // Billing & Shipping Address
    billing_address: Field9.address({
      label: "Billing Address",
      addressFormat: "international"
    }),
    shipping_address: Field9.address({
      label: "Shipping Address",
      addressFormat: "international"
    }),
    // Notes
    description: Field9.markdown({
      label: "Description"
    }),
    internal_notes: Field9.textarea({
      label: "Internal Notes"
    })
  },
  // Database indexes
  indexes: [
    { fields: ["account"], unique: false },
    { fields: ["opportunity"], unique: false },
    { fields: ["owner"], unique: false },
    { fields: ["status"], unique: false },
    { fields: ["quote_date"], unique: false }
  ],
  // Enable advanced features
  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    apiMethods: ["get", "list", "create", "update", "delete", "search", "export"],
    files: true,
    feeds: true,
    activities: true,
    trash: true,
    mru: true
  },
  // Validation Rules
  validations: [
    {
      name: "expiration_after_quote",
      type: "script",
      severity: "error",
      message: "Expiration Date must be after Quote Date",
      condition: "expiration_date <= quote_date"
    },
    {
      name: "valid_discount",
      type: "script",
      severity: "error",
      message: "Discount cannot exceed 100%",
      condition: "discount > 100"
    }
  ],
  // Workflow Rules
  workflows: [
    {
      name: "quote_expired_check",
      objectName: "quote",
      triggerType: "on_read",
      criteria: 'expiration_date < TODAY() AND status NOT IN ("accepted", "rejected", "expired")',
      actions: [
        {
          name: "mark_expired",
          type: "field_update",
          field: "status",
          value: '"expired"'
        }
      ],
      active: true
    }
  ]
});

// ../app-crm/src/objects/task.object.ts
import { ObjectSchema as ObjectSchema10, Field as Field10 } from "@objectstack/spec/data";
var Task = ObjectSchema10.create({
  name: "task",
  label: "Task",
  pluralLabel: "Tasks",
  icon: "check-square",
  description: "Activities and to-do items",
  fields: {
    // Task Information
    subject: Field10.text({
      label: "Subject",
      required: true,
      searchable: true,
      maxLength: 255
    }),
    description: Field10.markdown({
      label: "Description"
    }),
    // Task Management
    status: {
      type: "select",
      label: "Status",
      required: true,
      options: [
        { label: "Not Started", value: "not_started", color: "#808080", default: true },
        { label: "In Progress", value: "in_progress", color: "#FFA500" },
        { label: "Waiting", value: "waiting", color: "#FFD700" },
        { label: "Completed", value: "completed", color: "#00AA00" },
        { label: "Deferred", value: "deferred", color: "#999999" }
      ]
    },
    priority: {
      type: "select",
      label: "Priority",
      required: true,
      options: [
        { label: "Low", value: "low", color: "#4169E1", default: true },
        { label: "Normal", value: "normal", color: "#00AA00" },
        { label: "High", value: "high", color: "#FFA500" },
        { label: "Urgent", value: "urgent", color: "#FF0000" }
      ]
    },
    type: Field10.select(["Call", "Email", "Meeting", "Follow-up", "Demo", "Other"], {
      label: "Task Type"
    }),
    // Dates
    due_date: Field10.date({
      label: "Due Date"
    }),
    reminder_date: Field10.datetime({
      label: "Reminder Date/Time"
    }),
    completed_date: Field10.datetime({
      label: "Completed Date",
      readonly: true
    }),
    // Assignment
    owner: Field10.lookup("user", {
      label: "Assigned To",
      required: true
    }),
    // Related To (Polymorphic relationship - can link to multiple object types)
    related_to_type: Field10.select(["Account", "Contact", "Opportunity", "Lead", "Case"], {
      label: "Related To Type"
    }),
    related_to_account: Field10.lookup("account", {
      label: "Related Account"
    }),
    related_to_contact: Field10.lookup("contact", {
      label: "Related Contact"
    }),
    related_to_opportunity: Field10.lookup("opportunity", {
      label: "Related Opportunity"
    }),
    related_to_lead: Field10.lookup("lead", {
      label: "Related Lead"
    }),
    related_to_case: Field10.lookup("case", {
      label: "Related Case"
    }),
    // Recurrence (for recurring tasks)
    is_recurring: Field10.boolean({
      label: "Recurring Task",
      defaultValue: false
    }),
    recurrence_type: Field10.select(["Daily", "Weekly", "Monthly", "Yearly"], {
      label: "Recurrence Type"
    }),
    recurrence_interval: Field10.number({
      label: "Recurrence Interval",
      defaultValue: 1,
      min: 1
    }),
    recurrence_end_date: Field10.date({
      label: "Recurrence End Date"
    }),
    // Flags
    is_completed: Field10.boolean({
      label: "Is Completed",
      defaultValue: false,
      readonly: true
    }),
    is_overdue: Field10.boolean({
      label: "Is Overdue",
      defaultValue: false,
      readonly: true
    }),
    // Progress
    progress_percent: Field10.percent({
      label: "Progress (%)",
      min: 0,
      max: 100,
      defaultValue: 0
    }),
    // Time tracking
    estimated_hours: Field10.number({
      label: "Estimated Hours",
      scale: 2,
      min: 0
    }),
    actual_hours: Field10.number({
      label: "Actual Hours",
      scale: 2,
      min: 0
    })
  },
  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    files: true,
    feeds: true,
    // Enable social feed, comments, and mentions
    activities: true,
    // Enable tasks and events tracking
    trash: true,
    mru: true
    // Track Most Recently Used
  },
  titleFormat: "{subject}",
  compactLayout: ["subject", "status", "priority", "due_date", "owner"],
  // Removed: list_views and form_views belong in UI configuration, not object definition
  validations: [
    {
      name: "completed_date_required",
      type: "script",
      severity: "error",
      message: "Completed date is required when status is Completed",
      condition: 'status = "completed" AND ISBLANK(completed_date)'
    },
    {
      name: "recurrence_fields_required",
      type: "script",
      severity: "error",
      message: "Recurrence type is required for recurring tasks",
      condition: "is_recurring = true AND ISBLANK(recurrence_type)"
    },
    {
      name: "related_to_required",
      type: "script",
      severity: "warning",
      message: "At least one related record should be selected",
      condition: "ISBLANK(related_to_account) AND ISBLANK(related_to_contact) AND ISBLANK(related_to_opportunity) AND ISBLANK(related_to_lead) AND ISBLANK(related_to_case)"
    }
  ],
  workflows: [
    {
      name: "set_completed_flag",
      objectName: "task",
      triggerType: "on_create_or_update",
      criteria: "ISCHANGED(status)",
      active: true,
      actions: [
        {
          name: "update_completed_flag",
          type: "field_update",
          field: "is_completed",
          value: 'status = "completed"'
        }
      ]
    },
    {
      name: "set_completed_date",
      objectName: "task",
      triggerType: "on_update",
      criteria: 'ISCHANGED(status) AND status = "completed"',
      active: true,
      actions: [
        {
          name: "set_date",
          type: "field_update",
          field: "completed_date",
          value: "NOW()"
        },
        {
          name: "set_progress",
          type: "field_update",
          field: "progress_percent",
          value: "100"
        }
      ]
    },
    {
      name: "check_overdue",
      objectName: "task",
      triggerType: "on_create_or_update",
      criteria: "due_date < TODAY() AND is_completed = false",
      active: true,
      actions: [
        {
          name: "set_overdue_flag",
          type: "field_update",
          field: "is_overdue",
          value: "true"
        }
      ]
    },
    {
      name: "notify_on_urgent",
      objectName: "task",
      triggerType: "on_create_or_update",
      criteria: 'priority = "urgent" AND is_completed = false',
      active: true,
      actions: [
        {
          name: "email_owner",
          type: "email_alert",
          template: "urgent_task_alert",
          recipients: ["{owner.email}"]
        }
      ]
    }
  ]
});

// ../app-crm/src/apis/index.ts
var apis_exports = {};
__export(apis_exports, {
  LeadConvertApi: () => LeadConvertApi,
  PipelineStatsApi: () => PipelineStatsApi
});

// ../app-crm/src/apis/lead-convert.api.ts
import { ApiEndpoint } from "@objectstack/spec/api";
var LeadConvertApi = ApiEndpoint.create({
  name: "lead_convert",
  path: "/api/v1/crm/leads/convert",
  method: "POST",
  summary: "Convert Lead to Account/Contact",
  type: "flow",
  target: "flow_lead_conversion_v2",
  inputMapping: [
    { source: "body.leadId", target: "leadRecordId" },
    { source: "body.ownerId", target: "newOwnerId" }
  ]
});

// ../app-crm/src/apis/pipeline-stats.api.ts
import { ApiEndpoint as ApiEndpoint2 } from "@objectstack/spec/api";
var PipelineStatsApi = ApiEndpoint2.create({
  name: "get_pipeline_stats",
  path: "/api/v1/crm/stats/pipeline",
  method: "GET",
  summary: "Get Pipeline Statistics",
  description: "Returns the total value of open opportunities grouped by stage",
  type: "script",
  target: "server/scripts/pipeline_stats.ts",
  authRequired: true,
  cacheTtl: 300
});

// ../app-crm/src/actions/index.ts
var actions_exports = {};
__export(actions_exports, {
  CloneOpportunityAction: () => CloneOpportunityAction,
  CloseCaseAction: () => CloseCaseAction,
  ConvertLeadAction: () => ConvertLeadAction,
  CreateCampaignAction: () => CreateCampaignAction,
  EscalateCaseAction: () => EscalateCaseAction,
  ExportToCsvAction: () => ExportToCsvAction,
  LogCallAction: () => LogCallAction,
  MarkPrimaryContactAction: () => MarkPrimaryContactAction,
  MassUpdateStageAction: () => MassUpdateStageAction,
  SendEmailAction: () => SendEmailAction
});

// ../app-crm/src/actions/case.actions.ts
var EscalateCaseAction = {
  name: "escalate_case",
  label: "Escalate Case",
  objectName: "case",
  icon: "alert-triangle",
  type: "modal",
  target: "escalate_case_modal",
  locations: ["record_header", "list_item"],
  visible: "is_escalated = false AND is_closed = false",
  params: [
    {
      name: "reason",
      label: "Escalation Reason",
      type: "textarea",
      required: true
    }
  ],
  confirmText: "This will escalate the case to the escalation team. Continue?",
  successMessage: "Case escalated successfully!",
  refreshAfter: true
};
var CloseCaseAction = {
  name: "close_case",
  label: "Close Case",
  objectName: "case",
  icon: "check-circle",
  type: "modal",
  target: "close_case_modal",
  locations: ["record_header"],
  visible: "is_closed = false",
  params: [
    {
      name: "resolution",
      label: "Resolution",
      type: "textarea",
      required: true
    }
  ],
  confirmText: "Are you sure you want to close this case?",
  successMessage: "Case closed successfully!",
  refreshAfter: true
};

// ../app-crm/src/actions/contact.actions.ts
var MarkPrimaryContactAction = {
  name: "mark_primary",
  label: "Mark as Primary Contact",
  objectName: "contact",
  icon: "star",
  type: "script",
  target: "markAsPrimaryContact",
  locations: ["record_header", "list_item"],
  visible: "is_primary = false",
  confirmText: "Mark this contact as the primary contact for the account?",
  successMessage: "Contact marked as primary!",
  refreshAfter: true
};
var SendEmailAction = {
  name: "send_email",
  label: "Send Email",
  objectName: "contact",
  icon: "mail",
  type: "modal",
  target: "email_composer",
  locations: ["record_header", "list_item"],
  visible: "email_opt_out = false",
  refreshAfter: false
};

// ../app-crm/src/actions/global.actions.ts
var LogCallAction = {
  name: "log_call",
  label: "Log a Call",
  icon: "phone",
  type: "modal",
  target: "call_log_modal",
  locations: ["record_header", "list_item", "record_related"],
  params: [
    {
      name: "subject",
      label: "Call Subject",
      type: "text",
      required: true
    },
    {
      name: "duration",
      label: "Duration (minutes)",
      type: "number",
      required: true
    },
    {
      name: "notes",
      label: "Call Notes",
      type: "textarea",
      required: false
    }
  ],
  successMessage: "Call logged successfully!",
  refreshAfter: true
};
var ExportToCsvAction = {
  name: "export_csv",
  label: "Export to CSV",
  icon: "download",
  type: "script",
  target: "exportToCSV",
  locations: ["list_toolbar"],
  successMessage: "Export completed!",
  refreshAfter: false
};

// ../app-crm/src/actions/lead.actions.ts
var ConvertLeadAction = {
  name: "convert_lead",
  label: "Convert Lead",
  objectName: "lead",
  icon: "arrow-right-circle",
  type: "flow",
  target: "lead_conversion",
  locations: ["record_header", "list_item"],
  visible: 'status = "qualified" AND is_converted = false',
  confirmText: "Are you sure you want to convert this lead?",
  successMessage: "Lead converted successfully!",
  refreshAfter: true
};
var CreateCampaignAction = {
  name: "create_campaign",
  label: "Add to Campaign",
  objectName: "lead",
  icon: "send",
  type: "modal",
  target: "add_to_campaign_modal",
  locations: ["list_toolbar"],
  params: [
    {
      name: "campaign",
      label: "Campaign",
      type: "lookup",
      required: true
    }
  ],
  successMessage: "Leads added to campaign!",
  refreshAfter: true
};

// ../app-crm/src/actions/opportunity.actions.ts
var CloneOpportunityAction = {
  name: "clone_opportunity",
  label: "Clone Opportunity",
  objectName: "opportunity",
  icon: "copy",
  type: "script",
  target: "cloneRecord",
  locations: ["record_header", "record_more"],
  successMessage: "Opportunity cloned successfully!",
  refreshAfter: true
};
var MassUpdateStageAction = {
  name: "mass_update_stage",
  label: "Update Stage",
  objectName: "opportunity",
  icon: "layers",
  type: "modal",
  target: "mass_update_stage_modal",
  locations: ["list_toolbar"],
  params: [
    {
      name: "stage",
      label: "New Stage",
      type: "select",
      required: true,
      options: [
        { label: "Prospecting", value: "prospecting" },
        { label: "Qualification", value: "qualification" },
        { label: "Needs Analysis", value: "needs_analysis" },
        { label: "Proposal", value: "proposal" },
        { label: "Negotiation", value: "negotiation" },
        { label: "Closed Won", value: "closed_won" },
        { label: "Closed Lost", value: "closed_lost" }
      ]
    }
  ],
  successMessage: "Opportunities updated successfully!",
  refreshAfter: true
};

// ../app-crm/src/dashboards/index.ts
var dashboards_exports = {};
__export(dashboards_exports, {
  ExecutiveDashboard: () => ExecutiveDashboard,
  SalesDashboard: () => SalesDashboard,
  ServiceDashboard: () => ServiceDashboard
});

// ../app-crm/src/dashboards/executive.dashboard.ts
var ExecutiveDashboard = {
  name: "executive_dashboard",
  label: "Executive Overview",
  description: "High-level business metrics",
  widgets: [
    // Row 1: Revenue Metrics
    {
      id: "total_revenue_ytd",
      title: "Total Revenue (YTD)",
      type: "metric",
      object: "opportunity",
      filter: { stage: "closed_won", close_date: { $gte: "{current_year_start}" } },
      valueField: "amount",
      aggregate: "sum",
      layout: { x: 0, y: 0, w: 3, h: 2 },
      options: { prefix: "$", color: "#00AA00" }
    },
    {
      id: "total_accounts",
      title: "Total Accounts",
      type: "metric",
      object: "account",
      filter: { is_active: true },
      aggregate: "count",
      layout: { x: 3, y: 0, w: 3, h: 2 },
      options: { color: "#4169E1" }
    },
    {
      id: "total_contacts",
      title: "Total Contacts",
      type: "metric",
      object: "contact",
      aggregate: "count",
      layout: { x: 6, y: 0, w: 3, h: 2 },
      options: { color: "#9370DB" }
    },
    {
      id: "total_leads",
      title: "Total Leads",
      type: "metric",
      object: "lead",
      filter: { is_converted: false },
      aggregate: "count",
      layout: { x: 9, y: 0, w: 3, h: 2 },
      options: { color: "#FFA500" }
    },
    // Row 2: Revenue Analysis
    {
      id: "revenue_by_industry",
      title: "Revenue by Industry",
      type: "bar",
      object: "opportunity",
      filter: { stage: "closed_won", close_date: { $gte: "{current_year_start}" } },
      categoryField: "account.industry",
      valueField: "amount",
      aggregate: "sum",
      layout: { x: 0, y: 2, w: 6, h: 4 }
    },
    {
      id: "quarterly_revenue_trend",
      title: "Quarterly Revenue Trend",
      type: "line",
      object: "opportunity",
      filter: { stage: "closed_won", close_date: { $gte: "{last_4_quarters}" } },
      categoryField: "close_date",
      valueField: "amount",
      aggregate: "sum",
      layout: { x: 6, y: 2, w: 6, h: 4 },
      options: { dateGranularity: "quarter" }
    },
    // Row 3: Customer & Activity Metrics
    {
      id: "new_accounts_by_month",
      title: "New Accounts by Month",
      type: "bar",
      object: "account",
      filter: { created_date: { $gte: "{last_6_months}" } },
      categoryField: "created_date",
      aggregate: "count",
      layout: { x: 0, y: 6, w: 4, h: 4 },
      options: { dateGranularity: "month" }
    },
    {
      id: "lead_conversion_rate",
      title: "Lead Conversion Rate",
      type: "metric",
      object: "lead",
      valueField: "is_converted",
      aggregate: "avg",
      layout: { x: 4, y: 6, w: 4, h: 4 },
      options: { suffix: "%", color: "#00AA00" }
    },
    {
      id: "top_accounts_by_revenue",
      title: "Top Accounts by Revenue",
      type: "table",
      object: "account",
      aggregate: "count",
      layout: { x: 8, y: 6, w: 4, h: 4 },
      options: {
        columns: ["name", "annual_revenue", "type"],
        sortBy: "annual_revenue",
        sortOrder: "desc",
        limit: 10
      }
    }
  ]
};

// ../app-crm/src/dashboards/sales.dashboard.ts
var SalesDashboard = {
  name: "sales_dashboard",
  label: "Sales Performance",
  description: "Key sales metrics and pipeline overview",
  widgets: [
    // Row 1: Key Metrics
    {
      id: "total_pipeline_value",
      title: "Total Pipeline Value",
      type: "metric",
      object: "opportunity",
      filter: { stage: { $nin: ["closed_won", "closed_lost"] } },
      valueField: "amount",
      aggregate: "sum",
      layout: { x: 0, y: 0, w: 3, h: 2 },
      options: { prefix: "$", color: "#4169E1" }
    },
    {
      id: "closed_won_this_quarter",
      title: "Closed Won This Quarter",
      type: "metric",
      object: "opportunity",
      filter: { stage: "closed_won", close_date: { $gte: "{current_quarter_start}" } },
      valueField: "amount",
      aggregate: "sum",
      layout: { x: 3, y: 0, w: 3, h: 2 },
      options: { prefix: "$", color: "#00AA00" }
    },
    {
      id: "open_opportunities",
      title: "Open Opportunities",
      type: "metric",
      object: "opportunity",
      filter: { stage: { $nin: ["closed_won", "closed_lost"] } },
      aggregate: "count",
      layout: { x: 6, y: 0, w: 3, h: 2 },
      options: { color: "#FFA500" }
    },
    {
      id: "win_rate",
      title: "Win Rate",
      type: "metric",
      object: "opportunity",
      filter: { close_date: { $gte: "{current_quarter_start}" } },
      valueField: "stage",
      aggregate: "count",
      layout: { x: 9, y: 0, w: 3, h: 2 },
      options: { suffix: "%", color: "#9370DB" }
    },
    // Row 2: Pipeline Analysis
    {
      id: "pipeline_by_stage",
      title: "Pipeline by Stage",
      type: "funnel",
      object: "opportunity",
      filter: { stage: { $nin: ["closed_won", "closed_lost"] } },
      categoryField: "stage",
      valueField: "amount",
      aggregate: "sum",
      layout: { x: 0, y: 2, w: 6, h: 4 },
      options: { showValues: true }
    },
    {
      id: "opportunities_by_owner",
      title: "Opportunities by Owner",
      type: "bar",
      object: "opportunity",
      filter: { stage: { $nin: ["closed_won", "closed_lost"] } },
      categoryField: "owner",
      valueField: "amount",
      aggregate: "sum",
      layout: { x: 6, y: 2, w: 6, h: 4 },
      options: { horizontal: true }
    },
    // Row 3: Trends
    {
      id: "monthly_revenue_trend",
      title: "Monthly Revenue Trend",
      type: "line",
      object: "opportunity",
      filter: { stage: "closed_won", close_date: { $gte: "{last_12_months}" } },
      categoryField: "close_date",
      valueField: "amount",
      aggregate: "sum",
      layout: { x: 0, y: 6, w: 8, h: 4 },
      options: { dateGranularity: "month", showTrend: true }
    },
    {
      id: "top_opportunities",
      title: "Top Opportunities",
      type: "table",
      object: "opportunity",
      filter: { stage: { $nin: ["closed_won", "closed_lost"] } },
      aggregate: "count",
      layout: { x: 8, y: 6, w: 4, h: 4 },
      options: {
        columns: ["name", "amount", "stage", "close_date"],
        sortBy: "amount",
        sortOrder: "desc",
        limit: 10
      }
    }
  ]
};

// ../app-crm/src/dashboards/service.dashboard.ts
var ServiceDashboard = {
  name: "service_dashboard",
  label: "Customer Service",
  description: "Support case metrics and performance",
  widgets: [
    // Row 1: Key Metrics
    {
      id: "open_cases",
      title: "Open Cases",
      type: "metric",
      object: "case",
      filter: { is_closed: false },
      aggregate: "count",
      layout: { x: 0, y: 0, w: 3, h: 2 },
      options: { color: "#FFA500" }
    },
    {
      id: "critical_cases",
      title: "Critical Cases",
      type: "metric",
      object: "case",
      filter: { priority: "critical", is_closed: false },
      aggregate: "count",
      layout: { x: 3, y: 0, w: 3, h: 2 },
      options: { color: "#FF0000" }
    },
    {
      id: "avg_resolution_time",
      title: "Avg Resolution Time (hrs)",
      type: "metric",
      object: "case",
      filter: { is_closed: true },
      valueField: "resolution_time_hours",
      aggregate: "avg",
      layout: { x: 6, y: 0, w: 3, h: 2 },
      options: { suffix: "h", color: "#4169E1" }
    },
    {
      id: "sla_violations",
      title: "SLA Violations",
      type: "metric",
      object: "case",
      filter: { is_sla_violated: true },
      aggregate: "count",
      layout: { x: 9, y: 0, w: 3, h: 2 },
      options: { color: "#FF4500" }
    },
    // Row 2: Case Distribution
    {
      id: "cases_by_status",
      title: "Cases by Status",
      type: "pie",
      object: "case",
      filter: { is_closed: false },
      categoryField: "status",
      aggregate: "count",
      layout: { x: 0, y: 2, w: 4, h: 4 },
      options: { showLegend: true }
    },
    {
      id: "cases_by_priority",
      title: "Cases by Priority",
      type: "pie",
      object: "case",
      filter: { is_closed: false },
      categoryField: "priority",
      aggregate: "count",
      layout: { x: 4, y: 2, w: 4, h: 4 },
      options: { showLegend: true }
    },
    {
      id: "cases_by_origin",
      title: "Cases by Origin",
      type: "bar",
      object: "case",
      categoryField: "origin",
      aggregate: "count",
      layout: { x: 8, y: 2, w: 4, h: 4 }
    },
    // Row 3: Trends and Lists
    {
      id: "daily_case_volume",
      title: "Daily Case Volume",
      type: "line",
      object: "case",
      filter: { created_date: { $gte: "{last_30_days}" } },
      categoryField: "created_date",
      aggregate: "count",
      layout: { x: 0, y: 6, w: 8, h: 4 },
      options: { dateGranularity: "day" }
    },
    {
      id: "my_open_cases",
      title: "My Open Cases",
      type: "table",
      object: "case",
      filter: { owner: "{current_user}", is_closed: false },
      aggregate: "count",
      layout: { x: 8, y: 6, w: 4, h: 4 },
      options: {
        columns: ["case_number", "subject", "priority", "status"],
        sortBy: "priority",
        sortOrder: "desc",
        limit: 10
      }
    }
  ]
};

// ../app-crm/src/reports/index.ts
var reports_exports = {};
__export(reports_exports, {
  AccountsByIndustryTypeReport: () => AccountsByIndustryTypeReport,
  CasesByStatusPriorityReport: () => CasesByStatusPriorityReport,
  ContactsByAccountReport: () => ContactsByAccountReport,
  LeadsBySourceReport: () => LeadsBySourceReport,
  OpportunitiesByStageReport: () => OpportunitiesByStageReport,
  SlaPerformanceReport: () => SlaPerformanceReport,
  TasksByOwnerReport: () => TasksByOwnerReport,
  WonOpportunitiesByOwnerReport: () => WonOpportunitiesByOwnerReport
});

// ../app-crm/src/reports/account.report.ts
var AccountsByIndustryTypeReport = {
  name: "accounts_by_industry_type",
  label: "Accounts by Industry and Type",
  description: "Matrix report showing accounts by industry and type",
  objectName: "account",
  type: "matrix",
  columns: [
    { field: "name", aggregate: "count" },
    { field: "annual_revenue", aggregate: "sum" }
  ],
  groupingsDown: [{ field: "industry", sortOrder: "asc" }],
  groupingsAcross: [{ field: "type", sortOrder: "asc" }],
  filter: { is_active: true }
};

// ../app-crm/src/reports/case.report.ts
var CasesByStatusPriorityReport = {
  name: "cases_by_status_priority",
  label: "Cases by Status and Priority",
  description: "Summary of cases by status and priority",
  objectName: "case",
  type: "summary",
  columns: [
    { field: "case_number", label: "Case Number" },
    { field: "subject", label: "Subject" },
    { field: "account", label: "Account" },
    { field: "owner", label: "Owner" },
    { field: "resolution_time_hours", label: "Resolution Time", aggregate: "avg" }
  ],
  groupingsDown: [
    { field: "status", sortOrder: "asc" },
    { field: "priority", sortOrder: "desc" }
  ],
  chart: { type: "bar", title: "Cases by Status", showLegend: true, xAxis: "status", yAxis: "case_number" }
};
var SlaPerformanceReport = {
  name: "sla_performance",
  label: "SLA Performance Report",
  description: "Analysis of SLA compliance",
  objectName: "case",
  type: "summary",
  columns: [
    { field: "case_number", aggregate: "count" },
    { field: "is_sla_violated", label: "SLA Violated", aggregate: "count" },
    { field: "resolution_time_hours", label: "Avg Resolution Time", aggregate: "avg" }
  ],
  groupingsDown: [{ field: "priority", sortOrder: "desc" }],
  filter: { is_closed: true },
  chart: { type: "column", title: "SLA Violations by Priority", showLegend: false, xAxis: "priority", yAxis: "is_sla_violated" }
};

// ../app-crm/src/reports/contact.report.ts
var ContactsByAccountReport = {
  name: "contacts_by_account",
  label: "Contacts by Account",
  description: "List of contacts grouped by account",
  objectName: "contact",
  type: "summary",
  columns: [
    { field: "full_name", label: "Name" },
    { field: "title", label: "Title" },
    { field: "email", label: "Email" },
    { field: "phone", label: "Phone" },
    { field: "is_primary", label: "Primary Contact" }
  ],
  groupingsDown: [{ field: "account", sortOrder: "asc" }]
};

// ../app-crm/src/reports/lead.report.ts
var LeadsBySourceReport = {
  name: "leads_by_source",
  label: "Leads by Source and Status",
  description: "Lead pipeline analysis",
  objectName: "lead",
  type: "summary",
  columns: [
    { field: "full_name", label: "Name" },
    { field: "company", label: "Company" },
    { field: "rating", label: "Rating" }
  ],
  groupingsDown: [
    { field: "lead_source", sortOrder: "asc" },
    { field: "status", sortOrder: "asc" }
  ],
  filter: { is_converted: false },
  chart: { type: "pie", title: "Leads by Source", showLegend: true, xAxis: "lead_source", yAxis: "full_name" }
};

// ../app-crm/src/reports/opportunity.report.ts
var OpportunitiesByStageReport = {
  name: "opportunities_by_stage",
  label: "Opportunities by Stage",
  description: "Summary of opportunities grouped by stage",
  objectName: "opportunity",
  type: "summary",
  columns: [
    { field: "name", label: "Opportunity Name" },
    { field: "account", label: "Account" },
    { field: "amount", label: "Amount", aggregate: "sum" },
    { field: "close_date", label: "Close Date" },
    { field: "probability", label: "Probability", aggregate: "avg" }
  ],
  groupingsDown: [{ field: "stage", sortOrder: "asc" }],
  filter: { stage: { $ne: "closed_lost" }, close_date: { $gte: "{current_year_start}" } },
  chart: { type: "bar", title: "Pipeline by Stage", showLegend: true, xAxis: "stage", yAxis: "amount" }
};
var WonOpportunitiesByOwnerReport = {
  name: "won_opportunities_by_owner",
  label: "Won Opportunities by Owner",
  description: "Closed won opportunities grouped by owner",
  objectName: "opportunity",
  type: "summary",
  columns: [
    { field: "name", label: "Opportunity Name" },
    { field: "account", label: "Account" },
    { field: "amount", label: "Amount", aggregate: "sum" },
    { field: "close_date", label: "Close Date" }
  ],
  groupingsDown: [{ field: "owner", sortOrder: "desc" }],
  filter: { stage: "closed_won" },
  chart: { type: "column", title: "Revenue by Sales Rep", showLegend: false, xAxis: "owner", yAxis: "amount" }
};

// ../app-crm/src/reports/task.report.ts
var TasksByOwnerReport = {
  name: "tasks_by_owner",
  label: "Tasks by Owner",
  description: "Task summary by owner",
  objectName: "task",
  type: "summary",
  columns: [
    { field: "subject", label: "Subject" },
    { field: "status", label: "Status" },
    { field: "priority", label: "Priority" },
    { field: "due_date", label: "Due Date" },
    { field: "actual_hours", label: "Hours", aggregate: "sum" }
  ],
  groupingsDown: [{ field: "owner", sortOrder: "asc" }],
  filter: { is_completed: false }
};

// ../app-crm/src/flows/index.ts
var flows_exports = {};
__export(flows_exports, {
  CampaignEnrollmentFlow: () => CampaignEnrollmentFlow,
  CaseEscalationFlow: () => CaseEscalationFlow,
  LeadConversionFlow: () => LeadConversionFlow,
  OpportunityApprovalFlow: () => OpportunityApprovalFlow,
  QuoteGenerationFlow: () => QuoteGenerationFlow
});

// ../app-crm/src/flows/campaign-enrollment.flow.ts
var CampaignEnrollmentFlow = {
  name: "campaign_enrollment",
  label: "Enroll Leads in Campaign",
  description: "Bulk enroll leads into marketing campaigns",
  type: "schedule",
  variables: [
    { name: "campaignId", type: "text", isInput: true, isOutput: false },
    { name: "leadStatus", type: "text", isInput: true, isOutput: false }
  ],
  nodes: [
    { id: "start", type: "start", label: "Start (Monday 9 AM)", config: { schedule: "0 9 * * 1" } },
    {
      id: "get_campaign",
      type: "get_record",
      label: "Get Campaign",
      config: { objectName: "campaign", filter: { id: "{campaignId}" }, outputVariable: "campaignRecord" }
    },
    {
      id: "query_leads",
      type: "get_record",
      label: "Find Eligible Leads",
      config: { objectName: "lead", filter: { status: "{leadStatus}", is_converted: false, email: { $ne: null } }, limit: 1e3, outputVariable: "leadList" }
    },
    {
      id: "loop_leads",
      type: "loop",
      label: "Process Each Lead",
      config: { collection: "{leadList}", iteratorVariable: "currentLead" }
    },
    {
      id: "create_campaign_member",
      type: "create_record",
      label: "Add to Campaign",
      config: {
        objectName: "campaign_member",
        fields: { campaign: "{campaignId}", lead: "{currentLead.id}", status: "sent", added_date: "{NOW()}" }
      }
    },
    {
      id: "update_campaign_stats",
      type: "update_record",
      label: "Update Campaign Stats",
      config: { objectName: "campaign", filter: { id: "{campaignId}" }, fields: { num_sent: "{leadList.length}" } }
    },
    { id: "end", type: "end", label: "End" }
  ],
  edges: [
    { id: "e1", source: "start", target: "get_campaign", type: "default" },
    { id: "e2", source: "get_campaign", target: "query_leads", type: "default" },
    { id: "e3", source: "query_leads", target: "loop_leads", type: "default" },
    { id: "e4", source: "loop_leads", target: "create_campaign_member", type: "default" },
    { id: "e5", source: "create_campaign_member", target: "update_campaign_stats", type: "default" },
    { id: "e6", source: "update_campaign_stats", target: "end", type: "default" }
  ]
};

// ../app-crm/src/flows/case-escalation.flow.ts
var CaseEscalationFlow = {
  name: "case_escalation",
  label: "Case Escalation Process",
  description: "Automatically escalate high-priority cases",
  type: "record_change",
  variables: [
    { name: "caseId", type: "text", isInput: true, isOutput: false }
  ],
  nodes: [
    {
      id: "start",
      type: "start",
      label: "Start",
      config: { objectName: "case", criteria: 'priority = "critical" OR (priority = "high" AND account.type = "customer")' }
    },
    {
      id: "get_case",
      type: "get_record",
      label: "Get Case Record",
      config: { objectName: "case", filter: { id: "{caseId}" }, outputVariable: "caseRecord" }
    },
    {
      id: "assign_senior_agent",
      type: "update_record",
      label: "Assign to Senior Agent",
      config: {
        objectName: "case",
        filter: { id: "{caseId}" },
        fields: { owner: "{caseRecord.owner.manager}", is_escalated: true, escalated_date: "{NOW()}" }
      }
    },
    {
      id: "create_task",
      type: "create_record",
      label: "Create Follow-up Task",
      config: {
        objectName: "task",
        fields: {
          subject: "Follow up on escalated case: {caseRecord.case_number}",
          related_to: "{caseId}",
          owner: "{caseRecord.owner}",
          priority: "high",
          status: "not_started",
          due_date: "{TODAY() + 1}"
        }
      }
    },
    {
      id: "notify_team",
      type: "script",
      label: "Notify Support Team",
      config: {
        actionType: "email",
        template: "case_escalated",
        recipients: ["{caseRecord.owner}", "{caseRecord.owner.manager}", "support-team@example.com"],
        variables: {
          caseNumber: "{caseRecord.case_number}",
          priority: "{caseRecord.priority}",
          accountName: "{caseRecord.account.name}"
        }
      }
    },
    { id: "end", type: "end", label: "End" }
  ],
  edges: [
    { id: "e1", source: "start", target: "get_case", type: "default" },
    { id: "e2", source: "get_case", target: "assign_senior_agent", type: "default" },
    { id: "e3", source: "assign_senior_agent", target: "create_task", type: "default" },
    { id: "e4", source: "create_task", target: "notify_team", type: "default" },
    { id: "e5", source: "notify_team", target: "end", type: "default" }
  ]
};

// ../app-crm/src/flows/lead-conversion.flow.ts
var LeadConversionFlow = {
  name: "lead_conversion",
  label: "Lead Conversion Process",
  description: "Automated flow to convert qualified leads to accounts, contacts, and opportunities",
  type: "screen",
  variables: [
    { name: "leadId", type: "text", isInput: true, isOutput: false },
    { name: "createOpportunity", type: "boolean", isInput: true, isOutput: false },
    { name: "opportunityName", type: "text", isInput: true, isOutput: false },
    { name: "opportunityAmount", type: "text", isInput: true, isOutput: false }
  ],
  nodes: [
    { id: "start", type: "start", label: "Start", config: { objectName: "lead" } },
    {
      id: "screen_1",
      type: "screen",
      label: "Conversion Details",
      config: {
        fields: [
          { name: "createOpportunity", label: "Create Opportunity?", type: "boolean", required: true },
          { name: "opportunityName", label: "Opportunity Name", type: "text", required: true, visibleWhen: "{createOpportunity} == true" },
          { name: "opportunityAmount", label: "Opportunity Amount", type: "currency", visibleWhen: "{createOpportunity} == true" }
        ]
      }
    },
    {
      id: "get_lead",
      type: "get_record",
      label: "Get Lead Record",
      config: { objectName: "lead", filter: { id: "{leadId}" }, outputVariable: "leadRecord" }
    },
    {
      id: "create_account",
      type: "create_record",
      label: "Create Account",
      config: {
        objectName: "account",
        fields: {
          name: "{leadRecord.company}",
          phone: "{leadRecord.phone}",
          website: "{leadRecord.website}",
          industry: "{leadRecord.industry}",
          annual_revenue: "{leadRecord.annual_revenue}",
          number_of_employees: "{leadRecord.number_of_employees}",
          billing_address: "{leadRecord.address}",
          owner: "{$User.Id}",
          is_active: true
        },
        outputVariable: "accountId"
      }
    },
    {
      id: "create_contact",
      type: "create_record",
      label: "Create Contact",
      config: {
        objectName: "contact",
        fields: {
          first_name: "{leadRecord.first_name}",
          last_name: "{leadRecord.last_name}",
          email: "{leadRecord.email}",
          phone: "{leadRecord.phone}",
          title: "{leadRecord.title}",
          account: "{accountId}",
          is_primary: true,
          owner: "{$User.Id}"
        },
        outputVariable: "contactId"
      }
    },
    {
      id: "decision_opportunity",
      type: "decision",
      label: "Create Opportunity?",
      config: { condition: "{createOpportunity} == true" }
    },
    {
      id: "create_opportunity",
      type: "create_record",
      label: "Create Opportunity",
      config: {
        objectName: "opportunity",
        fields: {
          name: "{opportunityName}",
          account: "{accountId}",
          contact: "{contactId}",
          amount: "{opportunityAmount}",
          stage: "prospecting",
          probability: 10,
          lead_source: "{leadRecord.lead_source}",
          close_date: "{TODAY() + 90}",
          owner: "{$User.Id}"
        },
        outputVariable: "opportunityId"
      }
    },
    {
      id: "mark_converted",
      type: "update_record",
      label: "Mark Lead as Converted",
      config: {
        objectName: "lead",
        filter: { id: "{leadId}" },
        fields: {
          is_converted: true,
          converted_date: "{NOW()}",
          converted_account: "{accountId}",
          converted_contact: "{contactId}",
          converted_opportunity: "{opportunityId}"
        }
      }
    },
    {
      id: "send_notification",
      type: "script",
      label: "Send Confirmation Email",
      config: {
        actionType: "email",
        template: "lead_converted_notification",
        recipients: ["{$User.Email}"],
        variables: { leadName: "{leadRecord.full_name}", accountName: "{accountId.name}", contactName: "{contactId.full_name}" }
      }
    },
    { id: "end", type: "end", label: "End" }
  ],
  edges: [
    { id: "e1", source: "start", target: "screen_1", type: "default" },
    { id: "e2", source: "screen_1", target: "get_lead", type: "default" },
    { id: "e3", source: "get_lead", target: "create_account", type: "default" },
    { id: "e4", source: "create_account", target: "create_contact", type: "default" },
    { id: "e5", source: "create_contact", target: "decision_opportunity", type: "default" },
    { id: "e6", source: "decision_opportunity", target: "create_opportunity", type: "default", condition: "{createOpportunity} == true", label: "Yes" },
    { id: "e7", source: "decision_opportunity", target: "mark_converted", type: "default", condition: "{createOpportunity} != true", label: "No" },
    { id: "e8", source: "create_opportunity", target: "mark_converted", type: "default" },
    { id: "e9", source: "mark_converted", target: "send_notification", type: "default" },
    { id: "e10", source: "send_notification", target: "end", type: "default" }
  ]
};

// ../app-crm/src/flows/opportunity-approval.flow.ts
var OpportunityApprovalFlow = {
  name: "opportunity_approval",
  label: "Large Deal Approval",
  description: "Approval process for opportunities over $100K",
  type: "record_change",
  variables: [
    { name: "opportunityId", type: "text", isInput: true, isOutput: false }
  ],
  nodes: [
    {
      id: "start",
      type: "start",
      label: "Start",
      config: { objectName: "opportunity", criteria: 'amount > 100000 AND stage = "proposal"' }
    },
    {
      id: "get_opportunity",
      type: "get_record",
      label: "Get Opportunity",
      config: { objectName: "opportunity", filter: { id: "{opportunityId}" }, outputVariable: "oppRecord" }
    },
    {
      id: "approval_step_manager",
      type: "connector_action",
      label: "Sales Manager Approval",
      config: {
        actionType: "approval",
        approver: "{oppRecord.owner.manager}",
        emailTemplate: "opportunity_approval_request",
        comments: "required"
      }
    },
    {
      id: "decision_manager",
      type: "decision",
      label: "Manager Approved?",
      config: { condition: '{approval_step_manager.result} == "approved"' }
    },
    {
      id: "approval_step_director",
      type: "connector_action",
      label: "Sales Director Approval",
      config: {
        actionType: "approval",
        approver: "{oppRecord.owner.manager.manager}",
        emailTemplate: "opportunity_approval_request"
      }
    },
    {
      id: "decision_director",
      type: "decision",
      label: "Director Approved?",
      config: { condition: '{approval_step_director.result} == "approved"' }
    },
    {
      id: "mark_approved",
      type: "update_record",
      label: "Mark as Approved",
      config: {
        objectName: "opportunity",
        filter: { id: "{opportunityId}" },
        fields: { approval_status: "approved", approved_date: "{NOW()}" }
      }
    },
    {
      id: "notify_approval",
      type: "script",
      label: "Send Approval Notification",
      config: { actionType: "email", template: "opportunity_approved", recipients: ["{oppRecord.owner}"] }
    },
    {
      id: "notify_rejection",
      type: "script",
      label: "Send Rejection Notification",
      config: { actionType: "email", template: "opportunity_rejected", recipients: ["{oppRecord.owner}"] }
    },
    { id: "end", type: "end", label: "End" }
  ],
  edges: [
    { id: "e1", source: "start", target: "get_opportunity", type: "default" },
    { id: "e2", source: "get_opportunity", target: "approval_step_manager", type: "default" },
    { id: "e3", source: "approval_step_manager", target: "decision_manager", type: "default" },
    { id: "e4", source: "decision_manager", target: "approval_step_director", type: "default", condition: '{approval_step_manager.result} == "approved"', label: "Approved" },
    { id: "e5", source: "decision_manager", target: "notify_rejection", type: "default", condition: '{approval_step_manager.result} != "approved"', label: "Rejected" },
    { id: "e6", source: "approval_step_director", target: "decision_director", type: "default" },
    { id: "e7", source: "decision_director", target: "mark_approved", type: "default", condition: '{approval_step_director.result} == "approved"', label: "Approved" },
    { id: "e8", source: "decision_director", target: "notify_rejection", type: "default", condition: '{approval_step_director.result} != "approved"', label: "Rejected" },
    { id: "e9", source: "mark_approved", target: "notify_approval", type: "default" },
    { id: "e10", source: "notify_approval", target: "end", type: "default" },
    { id: "e11", source: "notify_rejection", target: "end", type: "default" }
  ]
};

// ../app-crm/src/flows/quote-generation.flow.ts
var QuoteGenerationFlow = {
  name: "quote_generation",
  label: "Generate Quote from Opportunity",
  description: "Create a quote based on opportunity details",
  type: "screen",
  variables: [
    { name: "opportunityId", type: "text", isInput: true, isOutput: false },
    { name: "quoteName", type: "text", isInput: true, isOutput: false },
    { name: "expirationDays", type: "number", isInput: true, isOutput: false },
    { name: "discount", type: "number", isInput: true, isOutput: false }
  ],
  nodes: [
    { id: "start", type: "start", label: "Start", config: { objectName: "opportunity" } },
    {
      id: "screen_1",
      type: "screen",
      label: "Quote Details",
      config: {
        fields: [
          { name: "quoteName", label: "Quote Name", type: "text", required: true },
          { name: "expirationDays", label: "Valid For (Days)", type: "number", required: true, defaultValue: 30 },
          { name: "discount", label: "Discount %", type: "percent", defaultValue: 0 }
        ]
      }
    },
    {
      id: "get_opportunity",
      type: "get_record",
      label: "Get Opportunity",
      config: { objectName: "opportunity", filter: { id: "{opportunityId}" }, outputVariable: "oppRecord" }
    },
    {
      id: "create_quote",
      type: "create_record",
      label: "Create Quote",
      config: {
        objectName: "quote",
        fields: {
          name: "{quoteName}",
          opportunity: "{opportunityId}",
          account: "{oppRecord.account}",
          contact: "{oppRecord.contact}",
          owner: "{$User.Id}",
          status: "draft",
          quote_date: "{TODAY()}",
          expiration_date: "{TODAY() + expirationDays}",
          subtotal: "{oppRecord.amount}",
          discount: "{discount}",
          discount_amount: "{oppRecord.amount * (discount / 100)}",
          total_price: "{oppRecord.amount * (1 - discount / 100)}",
          payment_terms: "net_30"
        },
        outputVariable: "quoteId"
      }
    },
    {
      id: "update_opportunity",
      type: "update_record",
      label: "Update Opportunity",
      config: {
        objectName: "opportunity",
        filter: { id: "{opportunityId}" },
        fields: { stage: "proposal", last_activity_date: "{TODAY()}" }
      }
    },
    {
      id: "notify_owner",
      type: "script",
      label: "Send Notification",
      config: {
        actionType: "email",
        template: "quote_created",
        recipients: ["{$User.Email}"],
        variables: { quoteName: "{quoteName}", quoteId: "{quoteId}" }
      }
    },
    { id: "end", type: "end", label: "End" }
  ],
  edges: [
    { id: "e1", source: "start", target: "screen_1", type: "default" },
    { id: "e2", source: "screen_1", target: "get_opportunity", type: "default" },
    { id: "e3", source: "get_opportunity", target: "create_quote", type: "default" },
    { id: "e4", source: "create_quote", target: "update_opportunity", type: "default" },
    { id: "e5", source: "update_opportunity", target: "notify_owner", type: "default" },
    { id: "e6", source: "notify_owner", target: "end", type: "default" }
  ]
};

// ../app-crm/src/agents/index.ts
var agents_exports = {};
__export(agents_exports, {
  EmailCampaignAgent: () => EmailCampaignAgent,
  LeadEnrichmentAgent: () => LeadEnrichmentAgent,
  RevenueIntelligenceAgent: () => RevenueIntelligenceAgent,
  SalesAssistantAgent: () => SalesAssistantAgent,
  ServiceAgent: () => ServiceAgent
});

// ../app-crm/src/agents/email-campaign.agent.ts
var EmailCampaignAgent = {
  name: "email_campaign",
  label: "Email Campaign Agent",
  role: "creator",
  instructions: `You are an email marketing AI that creates and optimizes email campaigns.

Your responsibilities:
1. Write compelling email copy
2. Optimize subject lines for open rates
3. Personalize content based on recipient data
4. A/B test different variations
5. Analyze campaign performance
6. Suggest improvements

Follow email marketing best practices and maintain brand voice.`,
  model: { provider: "anthropic", model: "claude-3-opus", temperature: 0.8, maxTokens: 2e3 },
  tools: [
    { type: "action", name: "generate_email_copy", description: "Generate email campaign copy" },
    { type: "action", name: "optimize_subject_line", description: "Optimize email subject line" },
    { type: "action", name: "personalize_content", description: "Personalize email content" }
  ],
  knowledge: {
    topics: ["email_marketing", "brand_guidelines", "campaign_templates"],
    indexes: ["sales_knowledge"]
  }
};

// ../app-crm/src/agents/lead-enrichment.agent.ts
var LeadEnrichmentAgent = {
  name: "lead_enrichment",
  label: "Lead Enrichment Agent",
  role: "worker",
  instructions: `You are a lead enrichment AI that enhances lead records with additional data.

Your responsibilities:
1. Look up company information from external databases
2. Enrich contact details (job title, LinkedIn, etc.)
3. Add firmographic data (industry, size, revenue)
4. Research company technology stack
5. Find social media profiles
6. Validate email addresses and phone numbers

Always use reputable data sources and maintain data quality.`,
  model: { provider: "openai", model: "gpt-3.5-turbo", temperature: 0.3, maxTokens: 1e3 },
  tools: [
    { type: "action", name: "lookup_company", description: "Look up company information" },
    { type: "action", name: "enrich_contact", description: "Enrich contact information" },
    { type: "action", name: "validate_email", description: "Validate email address" }
  ],
  knowledge: {
    topics: ["lead_enrichment", "company_data"],
    indexes: ["sales_knowledge"]
  },
  triggers: [
    { type: "object_create", objectName: "lead" }
  ],
  schedule: { type: "cron", expression: "0 */4 * * *", timezone: "UTC" }
};

// ../app-crm/src/agents/revenue-intelligence.agent.ts
var RevenueIntelligenceAgent = {
  name: "revenue_intelligence",
  label: "Revenue Intelligence Agent",
  role: "analyst",
  instructions: `You are a revenue intelligence AI that analyzes sales data and provides insights.

Your responsibilities:
1. Analyze pipeline health and quality
2. Identify at-risk deals
3. Forecast revenue with confidence intervals
4. Detect anomalies and trends
5. Suggest coaching opportunities
6. Generate executive summaries

Use statistical analysis and machine learning to provide data-driven insights.`,
  model: { provider: "openai", model: "gpt-4", temperature: 0.2, maxTokens: 3e3 },
  tools: [
    { type: "query", name: "analyze_pipeline", description: "Analyze sales pipeline health" },
    { type: "query", name: "identify_at_risk", description: "Identify at-risk opportunities" },
    { type: "query", name: "forecast_revenue", description: "Generate revenue forecast" }
  ],
  knowledge: {
    topics: ["pipeline_analytics", "revenue_forecasting", "deal_risk"],
    indexes: ["sales_knowledge"]
  },
  schedule: { type: "cron", expression: "0 8 * * 1", timezone: "America/Los_Angeles" }
};

// ../app-crm/src/agents/sales.agent.ts
var SalesAssistantAgent = {
  name: "sales_assistant",
  label: "Sales Assistant",
  role: "assistant",
  instructions: `You are a sales assistant AI helping sales representatives manage their pipeline.

Your responsibilities:
1. Qualify incoming leads based on BANT criteria (Budget, Authority, Need, Timeline)
2. Suggest next best actions for opportunities
3. Draft personalized email templates
4. Analyze win/loss patterns
5. Provide competitive intelligence
6. Generate sales forecasts

Always be professional, data-driven, and focused on helping close deals.`,
  model: { provider: "openai", model: "gpt-4", temperature: 0.7, maxTokens: 2e3 },
  tools: [
    { type: "action", name: "analyze_lead", description: "Analyze a lead and provide qualification score" },
    { type: "action", name: "suggest_next_action", description: "Suggest next best action for an opportunity" },
    { type: "action", name: "generate_email", description: "Generate a personalized email template" }
  ],
  knowledge: {
    topics: ["sales_playbook", "product_catalog", "lead_qualification"],
    indexes: ["sales_knowledge"]
  },
  triggers: [
    { type: "object_create", objectName: "lead", condition: 'rating = "hot"' },
    { type: "object_update", objectName: "opportunity", condition: "ISCHANGED(stage)" }
  ]
};

// ../app-crm/src/agents/service.agent.ts
var ServiceAgent = {
  name: "service_agent",
  label: "Customer Service Agent",
  role: "assistant",
  instructions: `You are a customer service AI agent helping support representatives resolve customer issues.

Your responsibilities:
1. Triage incoming cases based on priority and category
2. Suggest relevant knowledge articles
3. Draft response templates
4. Escalate critical issues
5. Identify common problems and patterns
6. Recommend process improvements

Always be empathetic, solution-focused, and customer-centric.`,
  model: { provider: "openai", model: "gpt-4", temperature: 0.5, maxTokens: 1500 },
  tools: [
    { type: "action", name: "triage_case", description: "Analyze case and assign priority" },
    { type: "vector_search", name: "search_knowledge", description: "Search knowledge base for solutions" },
    { type: "action", name: "generate_response", description: "Generate customer response" }
  ],
  knowledge: {
    topics: ["support_kb", "sla_policies", "case_resolution"],
    indexes: ["support_knowledge"]
  },
  triggers: [
    { type: "object_create", objectName: "case" },
    { type: "object_update", objectName: "case", condition: 'priority = "critical"' }
  ]
};

// ../app-crm/src/rag/index.ts
var rag_exports = {};
__export(rag_exports, {
  CompetitiveIntelRAG: () => CompetitiveIntelRAG,
  ProductInfoRAG: () => ProductInfoRAG,
  SalesKnowledgeRAG: () => SalesKnowledgeRAG,
  SupportKnowledgeRAG: () => SupportKnowledgeRAG
});

// ../app-crm/src/rag/competitive-intel.rag.ts
var CompetitiveIntelRAG = {
  name: "competitive_intel",
  label: "Competitive Intelligence Pipeline",
  description: "RAG pipeline for competitive analysis and market insights",
  embedding: {
    provider: "openai",
    model: "text-embedding-3-large",
    dimensions: 1536
  },
  vectorStore: {
    provider: "pgvector",
    indexName: "competitive_index",
    dimensions: 1536,
    metric: "cosine"
  },
  chunking: {
    type: "semantic",
    maxChunkSize: 1200
  },
  retrieval: {
    type: "similarity",
    topK: 7,
    scoreThreshold: 0.65
  },
  reranking: {
    enabled: true,
    provider: "cohere",
    model: "cohere-rerank",
    topK: 5
  },
  loaders: [
    { type: "directory", source: "/knowledge/competitive", fileTypes: [".md"], recursive: true },
    { type: "directory", source: "/knowledge/market-research", fileTypes: [".pdf"], recursive: true }
  ],
  maxContextTokens: 5e3,
  enableCache: true,
  cacheTTL: 1800
};

// ../app-crm/src/rag/product-info.rag.ts
var ProductInfoRAG = {
  name: "product_info",
  label: "Product Information Pipeline",
  description: "RAG pipeline for product catalog and specifications",
  embedding: {
    provider: "openai",
    model: "text-embedding-3-small",
    dimensions: 768
  },
  vectorStore: {
    provider: "pgvector",
    indexName: "product_catalog_index",
    dimensions: 768,
    metric: "cosine"
  },
  chunking: {
    type: "semantic",
    maxChunkSize: 800
  },
  retrieval: {
    type: "hybrid",
    topK: 8,
    vectorWeight: 0.6,
    keywordWeight: 0.4
  },
  loaders: [
    { type: "directory", source: "/knowledge/products", fileTypes: [".md", ".pdf"], recursive: true }
  ],
  maxContextTokens: 2e3,
  enableCache: true,
  cacheTTL: 3600
};

// ../app-crm/src/rag/sales-knowledge.rag.ts
var SalesKnowledgeRAG = {
  name: "sales_knowledge",
  label: "Sales Knowledge Pipeline",
  description: "RAG pipeline for sales team knowledge and best practices",
  embedding: {
    provider: "openai",
    model: "text-embedding-3-large",
    dimensions: 1536
  },
  vectorStore: {
    provider: "pgvector",
    indexName: "sales_playbook_index",
    dimensions: 1536,
    metric: "cosine"
  },
  chunking: {
    type: "semantic",
    maxChunkSize: 1e3
  },
  retrieval: {
    type: "hybrid",
    topK: 10,
    vectorWeight: 0.7,
    keywordWeight: 0.3
  },
  reranking: {
    enabled: true,
    provider: "cohere",
    model: "cohere-rerank",
    topK: 5
  },
  loaders: [
    { type: "directory", source: "/knowledge/sales", fileTypes: [".md"], recursive: true },
    { type: "directory", source: "/knowledge/products", fileTypes: [".pdf"], recursive: true }
  ],
  maxContextTokens: 4e3,
  enableCache: true,
  cacheTTL: 3600
};

// ../app-crm/src/rag/support-knowledge.rag.ts
var SupportKnowledgeRAG = {
  name: "support_knowledge",
  label: "Support Knowledge Pipeline",
  description: "RAG pipeline for customer support knowledge base",
  embedding: {
    provider: "openai",
    model: "text-embedding-3-small",
    dimensions: 768
  },
  vectorStore: {
    provider: "pgvector",
    indexName: "support_kb_index",
    dimensions: 768,
    metric: "cosine"
  },
  chunking: {
    type: "fixed",
    chunkSize: 512,
    chunkOverlap: 100,
    unit: "tokens"
  },
  retrieval: {
    type: "similarity",
    topK: 5,
    scoreThreshold: 0.75
  },
  loaders: [
    { type: "directory", source: "/knowledge/support", fileTypes: [".md"], recursive: true }
  ],
  maxContextTokens: 3e3,
  enableCache: true,
  cacheTTL: 3600
};

// ../app-crm/src/profiles/index.ts
var profiles_exports = {};
__export(profiles_exports, {
  MarketingUserProfile: () => MarketingUserProfile,
  SalesManagerProfile: () => SalesManagerProfile,
  SalesRepProfile: () => SalesRepProfile,
  ServiceAgentProfile: () => ServiceAgentProfile,
  SystemAdminProfile: () => SystemAdminProfile
});

// ../app-crm/src/profiles/marketing-user.profile.ts
var MarketingUserProfile = {
  name: "marketing_user",
  label: "Marketing User",
  isProfile: true,
  objects: {
    lead: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: false, viewAllRecords: true, modifyAllRecords: false },
    account: { allowCreate: false, allowRead: true, allowEdit: false, allowDelete: false, viewAllRecords: true, modifyAllRecords: false },
    contact: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: false, viewAllRecords: true, modifyAllRecords: false },
    campaign: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: false, viewAllRecords: true, modifyAllRecords: false },
    opportunity: { allowCreate: false, allowRead: true, allowEdit: false, allowDelete: false, viewAllRecords: false, modifyAllRecords: false }
  }
};

// ../app-crm/src/profiles/sales-manager.profile.ts
var SalesManagerProfile = {
  name: "sales_manager",
  label: "Sales Manager",
  isProfile: true,
  objects: {
    lead: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: true, viewAllRecords: true, modifyAllRecords: true },
    account: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: true, viewAllRecords: true, modifyAllRecords: true },
    contact: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: true, viewAllRecords: true, modifyAllRecords: true },
    opportunity: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: true, viewAllRecords: true, modifyAllRecords: true },
    quote: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: true, viewAllRecords: true, modifyAllRecords: true },
    contract: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: false, viewAllRecords: true, modifyAllRecords: false },
    product: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: false, viewAllRecords: true, modifyAllRecords: false },
    campaign: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: false, viewAllRecords: true, modifyAllRecords: false },
    case: { allowCreate: false, allowRead: true, allowEdit: false, allowDelete: false, viewAllRecords: true, modifyAllRecords: false },
    task: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: true, viewAllRecords: true, modifyAllRecords: true }
  }
};

// ../app-crm/src/profiles/sales-rep.profile.ts
var SalesRepProfile = {
  name: "sales_rep",
  label: "Sales Representative",
  isProfile: true,
  objects: {
    lead: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: false, viewAllRecords: false, modifyAllRecords: false },
    account: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: false, viewAllRecords: false, modifyAllRecords: false },
    contact: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: false, viewAllRecords: false, modifyAllRecords: false },
    opportunity: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: false, viewAllRecords: false, modifyAllRecords: false },
    quote: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: false, viewAllRecords: false, modifyAllRecords: false },
    contract: { allowCreate: false, allowRead: true, allowEdit: false, allowDelete: false, viewAllRecords: false, modifyAllRecords: false },
    product: { allowCreate: false, allowRead: true, allowEdit: false, allowDelete: false, viewAllRecords: true, modifyAllRecords: false },
    campaign: { allowCreate: false, allowRead: true, allowEdit: false, allowDelete: false, viewAllRecords: true, modifyAllRecords: false },
    case: { allowCreate: false, allowRead: true, allowEdit: false, allowDelete: false, viewAllRecords: false, modifyAllRecords: false },
    task: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: true, viewAllRecords: false, modifyAllRecords: false }
  },
  fields: {
    "account.annual_revenue": { readable: true, editable: false },
    "account.description": { readable: true, editable: true },
    "opportunity.amount": { readable: true, editable: true },
    "opportunity.probability": { readable: true, editable: true }
  }
};

// ../app-crm/src/profiles/service-agent.profile.ts
var ServiceAgentProfile = {
  name: "service_agent",
  label: "Service Agent",
  isProfile: true,
  objects: {
    lead: { allowCreate: false, allowRead: true, allowEdit: false, allowDelete: false, viewAllRecords: false, modifyAllRecords: false },
    account: { allowCreate: false, allowRead: true, allowEdit: false, allowDelete: false, viewAllRecords: false, modifyAllRecords: false },
    contact: { allowCreate: false, allowRead: true, allowEdit: true, allowDelete: false, viewAllRecords: false, modifyAllRecords: false },
    opportunity: { allowCreate: false, allowRead: false, allowEdit: false, allowDelete: false, viewAllRecords: false, modifyAllRecords: false },
    case: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: false, viewAllRecords: false, modifyAllRecords: false },
    task: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: true, viewAllRecords: false, modifyAllRecords: false },
    product: { allowCreate: false, allowRead: true, allowEdit: false, allowDelete: false, viewAllRecords: true, modifyAllRecords: false }
  },
  fields: {
    "case.is_sla_violated": { readable: true, editable: false },
    "case.resolution_time_hours": { readable: true, editable: false }
  }
};

// ../app-crm/src/profiles/system-admin.profile.ts
var SystemAdminProfile = {
  name: "system_admin",
  label: "System Administrator",
  isProfile: true,
  objects: {
    lead: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: true, viewAllRecords: true, modifyAllRecords: true },
    account: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: true, viewAllRecords: true, modifyAllRecords: true },
    contact: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: true, viewAllRecords: true, modifyAllRecords: true },
    opportunity: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: true, viewAllRecords: true, modifyAllRecords: true },
    quote: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: true, viewAllRecords: true, modifyAllRecords: true },
    contract: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: true, viewAllRecords: true, modifyAllRecords: true },
    product: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: true, viewAllRecords: true, modifyAllRecords: true },
    campaign: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: true, viewAllRecords: true, modifyAllRecords: true },
    case: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: true, viewAllRecords: true, modifyAllRecords: true },
    task: { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: true, viewAllRecords: true, modifyAllRecords: true }
  },
  systemPermissions: [
    "view_setup",
    "manage_users",
    "customize_application",
    "view_all_data",
    "modify_all_data",
    "manage_profiles",
    "manage_roles",
    "manage_sharing"
  ]
};

// ../app-crm/src/apps/index.ts
var apps_exports = {};
__export(apps_exports, {
  CrmApp: () => CrmApp
});

// ../app-crm/src/apps/crm.app.ts
import { App } from "@objectstack/spec/ui";
var CrmApp = App.create({
  name: "crm_enterprise",
  label: "Enterprise CRM",
  icon: "briefcase",
  branding: {
    primaryColor: "#4169E1",
    secondaryColor: "#00AA00",
    logo: "/assets/crm-logo.png",
    favicon: "/assets/crm-favicon.ico"
  },
  navigation: [
    {
      id: "group_sales",
      type: "group",
      label: "Sales",
      icon: "chart-line",
      children: [
        { id: "nav_lead", type: "object", objectName: "lead", label: "Leads", icon: "user-plus" },
        { id: "nav_account", type: "object", objectName: "account", label: "Accounts", icon: "building" },
        { id: "nav_contact", type: "object", objectName: "contact", label: "Contacts", icon: "user" },
        { id: "nav_opportunity", type: "object", objectName: "opportunity", label: "Opportunities", icon: "bullseye" },
        { id: "nav_quote", type: "object", objectName: "quote", label: "Quotes", icon: "file-invoice" },
        { id: "nav_contract", type: "object", objectName: "contract", label: "Contracts", icon: "file-signature" },
        { id: "nav_sales_dashboard", type: "dashboard", dashboardName: "sales_dashboard", label: "Sales Dashboard", icon: "chart-bar" }
      ]
    },
    {
      id: "group_service",
      type: "group",
      label: "Service",
      icon: "headset",
      children: [
        { id: "nav_case", type: "object", objectName: "case", label: "Cases", icon: "life-ring" },
        { id: "nav_task", type: "object", objectName: "task", label: "Tasks", icon: "tasks" },
        { id: "nav_service_dashboard", type: "dashboard", dashboardName: "service_dashboard", label: "Service Dashboard", icon: "chart-pie" }
      ]
    },
    {
      id: "group_marketing",
      type: "group",
      label: "Marketing",
      icon: "megaphone",
      children: [
        { id: "nav_campaign", type: "object", objectName: "campaign", label: "Campaigns", icon: "bullhorn" },
        { id: "nav_lead_marketing", type: "object", objectName: "lead", label: "Leads", icon: "user-plus" }
      ]
    },
    {
      id: "group_products",
      type: "group",
      label: "Products",
      icon: "box",
      children: [
        { id: "nav_product", type: "object", objectName: "product", label: "Products", icon: "box-open" }
      ]
    },
    {
      id: "group_analytics",
      type: "group",
      label: "Analytics",
      icon: "chart-area",
      children: [
        { id: "nav_exec_dashboard", type: "dashboard", dashboardName: "executive_dashboard", label: "Executive Dashboard", icon: "tachometer-alt" },
        { id: "nav_analytics_sales_db", type: "dashboard", dashboardName: "sales_dashboard", label: "Sales Analytics", icon: "chart-line" },
        { id: "nav_analytics_service_db", type: "dashboard", dashboardName: "service_dashboard", label: "Service Analytics", icon: "chart-pie" }
      ]
    }
  ]
});

// ../app-crm/src/apps/crm_modern.app.ts
import { defineApp } from "@objectstack/spec/ui";
var CrmApp2 = defineApp({
  name: "crm",
  label: "Sales CRM",
  description: "Enterprise CRM with nested navigation tree",
  icon: "briefcase",
  branding: {
    primaryColor: "#4169E1",
    logo: "/assets/crm-logo.png",
    favicon: "/assets/crm-favicon.ico"
  },
  navigation: [
    // ── Sales Cloud ──
    {
      id: "grp_sales",
      type: "group",
      label: "Sales Cloud",
      icon: "briefcase",
      expanded: true,
      children: [
        { id: "nav_pipeline", type: "page", label: "Pipeline", icon: "columns", pageName: "page_pipeline" },
        { id: "nav_accounts", type: "page", label: "Accounts", icon: "building", pageName: "page_accounts" },
        { id: "nav_leads", type: "page", label: "Leads", icon: "user-plus", pageName: "page_leads" },
        // Nested sub-group — impossible with the old Interface model
        {
          id: "grp_review",
          type: "group",
          label: "Lead Review",
          icon: "clipboard-check",
          expanded: false,
          children: [
            { id: "nav_review_queue", type: "page", label: "Review Queue", icon: "check-square", pageName: "page_review_queue" },
            { id: "nav_qualified", type: "page", label: "Qualified", icon: "check-circle", pageName: "page_qualified" }
          ]
        }
      ]
    },
    // ── Analytics ──
    {
      id: "grp_analytics",
      type: "group",
      label: "Analytics",
      icon: "chart-line",
      expanded: false,
      children: [
        { id: "nav_overview", type: "page", label: "Overview", icon: "gauge", pageName: "page_overview" },
        { id: "nav_pipeline_report", type: "page", label: "Pipeline Report", icon: "chart-bar", pageName: "page_pipeline_report" }
      ]
    },
    // ── Global Utility ──
    { id: "nav_settings", type: "page", label: "Settings", icon: "settings", pageName: "admin_settings" },
    { id: "nav_help", type: "url", label: "Help", icon: "help-circle", url: "https://help.example.com", target: "_blank" }
  ],
  homePageId: "nav_pipeline",
  requiredPermissions: ["app.access.crm"],
  isDefault: true
});

// ../app-crm/objectstack.config.ts
var interfaces = __toESM(require_interfaces());

// ../app-crm/src/translations/index.ts
var translations_exports = {};
__export(translations_exports, {
  CrmTranslations: () => CrmTranslations
});

// ../app-crm/src/translations/en.ts
var en = {
  objects: {
    account: {
      label: "Account",
      pluralLabel: "Accounts",
      fields: {
        account_number: { label: "Account Number" },
        name: { label: "Account Name", help: "Legal name of the company or organization" },
        type: {
          label: "Type",
          options: { prospect: "Prospect", customer: "Customer", partner: "Partner", former: "Former" }
        },
        industry: {
          label: "Industry",
          options: {
            technology: "Technology",
            finance: "Finance",
            healthcare: "Healthcare",
            retail: "Retail",
            manufacturing: "Manufacturing",
            education: "Education"
          }
        },
        annual_revenue: { label: "Annual Revenue" },
        number_of_employees: { label: "Number of Employees" },
        phone: { label: "Phone" },
        website: { label: "Website" },
        billing_address: { label: "Billing Address" },
        office_location: { label: "Office Location" },
        owner: { label: "Account Owner" },
        parent_account: { label: "Parent Account" },
        description: { label: "Description" },
        is_active: { label: "Active" },
        last_activity_date: { label: "Last Activity Date" }
      }
    },
    contact: {
      label: "Contact",
      pluralLabel: "Contacts",
      fields: {
        salutation: { label: "Salutation" },
        first_name: { label: "First Name" },
        last_name: { label: "Last Name" },
        full_name: { label: "Full Name" },
        account: { label: "Account" },
        email: { label: "Email" },
        phone: { label: "Phone" },
        mobile: { label: "Mobile" },
        title: { label: "Title" },
        department: {
          label: "Department",
          options: {
            Executive: "Executive",
            Sales: "Sales",
            Marketing: "Marketing",
            Engineering: "Engineering",
            Support: "Support",
            Finance: "Finance",
            HR: "Human Resources",
            Operations: "Operations"
          }
        },
        owner: { label: "Contact Owner" },
        description: { label: "Description" },
        is_primary: { label: "Primary Contact" }
      }
    },
    lead: {
      label: "Lead",
      pluralLabel: "Leads",
      fields: {
        first_name: { label: "First Name" },
        last_name: { label: "Last Name" },
        company: { label: "Company" },
        title: { label: "Title" },
        email: { label: "Email" },
        phone: { label: "Phone" },
        status: {
          label: "Status",
          options: {
            new: "New",
            contacted: "Contacted",
            qualified: "Qualified",
            unqualified: "Unqualified",
            converted: "Converted"
          }
        },
        lead_source: {
          label: "Lead Source",
          options: {
            Web: "Web",
            Referral: "Referral",
            Event: "Event",
            Partner: "Partner",
            Advertisement: "Advertisement",
            "Cold Call": "Cold Call"
          }
        },
        owner: { label: "Lead Owner" },
        is_converted: { label: "Converted" },
        description: { label: "Description" }
      }
    },
    opportunity: {
      label: "Opportunity",
      pluralLabel: "Opportunities",
      fields: {
        name: { label: "Opportunity Name" },
        account: { label: "Account" },
        primary_contact: { label: "Primary Contact" },
        owner: { label: "Opportunity Owner" },
        amount: { label: "Amount" },
        expected_revenue: { label: "Expected Revenue" },
        stage: {
          label: "Stage",
          options: {
            prospecting: "Prospecting",
            qualification: "Qualification",
            needs_analysis: "Needs Analysis",
            proposal: "Proposal",
            negotiation: "Negotiation",
            closed_won: "Closed Won",
            closed_lost: "Closed Lost"
          }
        },
        probability: { label: "Probability (%)" },
        close_date: { label: "Close Date" },
        type: {
          label: "Type",
          options: {
            "New Business": "New Business",
            "Existing Customer - Upgrade": "Existing Customer - Upgrade",
            "Existing Customer - Renewal": "Existing Customer - Renewal",
            "Existing Customer - Expansion": "Existing Customer - Expansion"
          }
        },
        forecast_category: {
          label: "Forecast Category",
          options: {
            Pipeline: "Pipeline",
            "Best Case": "Best Case",
            Commit: "Commit",
            Omitted: "Omitted",
            Closed: "Closed"
          }
        },
        description: { label: "Description" },
        next_step: { label: "Next Step" }
      }
    }
  },
  apps: {
    crm_enterprise: {
      label: "Enterprise CRM",
      description: "Customer relationship management for sales, service, and marketing"
    }
  },
  messages: {
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.create": "Create",
    "common.search": "Search",
    "common.filter": "Filter",
    "common.export": "Export",
    "common.back": "Back",
    "common.confirm": "Confirm",
    "nav.sales": "Sales",
    "nav.service": "Service",
    "nav.marketing": "Marketing",
    "nav.products": "Products",
    "nav.analytics": "Analytics",
    "success.saved": "Record saved successfully",
    "success.converted": "Lead converted successfully",
    "confirm.delete": "Are you sure you want to delete this record?",
    "confirm.convert_lead": "Convert this lead to account, contact, and opportunity?",
    "error.required": "This field is required",
    "error.load_failed": "Failed to load data"
  },
  validationMessages: {
    amount_required_for_closed: "Amount is required when stage is Closed Won",
    close_date_required: "Close date is required for opportunities",
    discount_limit: "Discount cannot exceed 40%"
  }
};

// ../app-crm/src/translations/zh-CN.ts
var zhCN = {
  objects: {
    account: {
      label: "\u5BA2\u6237",
      pluralLabel: "\u5BA2\u6237",
      fields: {
        account_number: { label: "\u5BA2\u6237\u7F16\u53F7" },
        name: { label: "\u5BA2\u6237\u540D\u79F0", help: "\u516C\u53F8\u6216\u7EC4\u7EC7\u7684\u6CD5\u5B9A\u540D\u79F0" },
        type: {
          label: "\u7C7B\u578B",
          options: { prospect: "\u6F5C\u5728\u5BA2\u6237", customer: "\u6B63\u5F0F\u5BA2\u6237", partner: "\u5408\u4F5C\u4F19\u4F34", former: "\u524D\u5BA2\u6237" }
        },
        industry: {
          label: "\u884C\u4E1A",
          options: {
            technology: "\u79D1\u6280",
            finance: "\u91D1\u878D",
            healthcare: "\u533B\u7597",
            retail: "\u96F6\u552E",
            manufacturing: "\u5236\u9020",
            education: "\u6559\u80B2"
          }
        },
        annual_revenue: { label: "\u5E74\u8425\u6536" },
        number_of_employees: { label: "\u5458\u5DE5\u4EBA\u6570" },
        phone: { label: "\u7535\u8BDD" },
        website: { label: "\u7F51\u7AD9" },
        billing_address: { label: "\u8D26\u5355\u5730\u5740" },
        office_location: { label: "\u529E\u516C\u5730\u70B9" },
        owner: { label: "\u5BA2\u6237\u8D1F\u8D23\u4EBA" },
        parent_account: { label: "\u6BCD\u516C\u53F8" },
        description: { label: "\u63CF\u8FF0" },
        is_active: { label: "\u662F\u5426\u6D3B\u8DC3" },
        last_activity_date: { label: "\u6700\u8FD1\u6D3B\u52A8\u65E5\u671F" }
      }
    },
    contact: {
      label: "\u8054\u7CFB\u4EBA",
      pluralLabel: "\u8054\u7CFB\u4EBA",
      fields: {
        salutation: { label: "\u79F0\u8C13" },
        first_name: { label: "\u540D" },
        last_name: { label: "\u59D3" },
        full_name: { label: "\u5168\u540D" },
        account: { label: "\u6240\u5C5E\u5BA2\u6237" },
        email: { label: "\u90AE\u7BB1" },
        phone: { label: "\u7535\u8BDD" },
        mobile: { label: "\u624B\u673A" },
        title: { label: "\u804C\u4F4D" },
        department: {
          label: "\u90E8\u95E8",
          options: {
            Executive: "\u7BA1\u7406\u5C42",
            Sales: "\u9500\u552E\u90E8",
            Marketing: "\u5E02\u573A\u90E8",
            Engineering: "\u5DE5\u7A0B\u90E8",
            Support: "\u652F\u6301\u90E8",
            Finance: "\u8D22\u52A1\u90E8",
            HR: "\u4EBA\u529B\u8D44\u6E90",
            Operations: "\u8FD0\u8425\u90E8"
          }
        },
        owner: { label: "\u8054\u7CFB\u4EBA\u8D1F\u8D23\u4EBA" },
        description: { label: "\u63CF\u8FF0" },
        is_primary: { label: "\u4E3B\u8981\u8054\u7CFB\u4EBA" }
      }
    },
    lead: {
      label: "\u7EBF\u7D22",
      pluralLabel: "\u7EBF\u7D22",
      fields: {
        first_name: { label: "\u540D" },
        last_name: { label: "\u59D3" },
        company: { label: "\u516C\u53F8" },
        title: { label: "\u804C\u4F4D" },
        email: { label: "\u90AE\u7BB1" },
        phone: { label: "\u7535\u8BDD" },
        status: {
          label: "\u72B6\u6001",
          options: {
            new: "\u65B0\u5EFA",
            contacted: "\u5DF2\u8054\u7CFB",
            qualified: "\u5DF2\u786E\u8BA4",
            unqualified: "\u4E0D\u5408\u683C",
            converted: "\u5DF2\u8F6C\u5316"
          }
        },
        lead_source: {
          label: "\u7EBF\u7D22\u6765\u6E90",
          options: {
            Web: "\u7F51\u7AD9",
            Referral: "\u63A8\u8350",
            Event: "\u6D3B\u52A8",
            Partner: "\u5408\u4F5C\u4F19\u4F34",
            Advertisement: "\u5E7F\u544A",
            "Cold Call": "\u964C\u751F\u62DC\u8BBF"
          }
        },
        owner: { label: "\u7EBF\u7D22\u8D1F\u8D23\u4EBA" },
        is_converted: { label: "\u5DF2\u8F6C\u5316" },
        description: { label: "\u63CF\u8FF0" }
      }
    },
    opportunity: {
      label: "\u5546\u673A",
      pluralLabel: "\u5546\u673A",
      fields: {
        name: { label: "\u5546\u673A\u540D\u79F0" },
        account: { label: "\u6240\u5C5E\u5BA2\u6237" },
        primary_contact: { label: "\u4E3B\u8981\u8054\u7CFB\u4EBA" },
        owner: { label: "\u5546\u673A\u8D1F\u8D23\u4EBA" },
        amount: { label: "\u91D1\u989D" },
        expected_revenue: { label: "\u9884\u671F\u6536\u5165" },
        stage: {
          label: "\u9636\u6BB5",
          options: {
            prospecting: "\u5BFB\u627E\u5BA2\u6237",
            qualification: "\u8D44\u683C\u5BA1\u67E5",
            needs_analysis: "\u9700\u6C42\u5206\u6790",
            proposal: "\u63D0\u6848",
            negotiation: "\u8C08\u5224",
            closed_won: "\u6210\u4EA4",
            closed_lost: "\u5931\u8D25"
          }
        },
        probability: { label: "\u6210\u4EA4\u6982\u7387 (%)" },
        close_date: { label: "\u9884\u8BA1\u6210\u4EA4\u65E5\u671F" },
        type: {
          label: "\u7C7B\u578B",
          options: {
            "New Business": "\u65B0\u4E1A\u52A1",
            "Existing Customer - Upgrade": "\u8001\u5BA2\u6237\u5347\u7EA7",
            "Existing Customer - Renewal": "\u8001\u5BA2\u6237\u7EED\u7EA6",
            "Existing Customer - Expansion": "\u8001\u5BA2\u6237\u62D3\u5C55"
          }
        },
        forecast_category: {
          label: "\u9884\u6D4B\u7C7B\u522B",
          options: {
            Pipeline: "\u7BA1\u9053",
            "Best Case": "\u6700\u4F73\u60C5\u51B5",
            Commit: "\u627F\u8BFA",
            Omitted: "\u5DF2\u6392\u9664",
            Closed: "\u5DF2\u5173\u95ED"
          }
        },
        description: { label: "\u63CF\u8FF0" },
        next_step: { label: "\u4E0B\u4E00\u6B65" }
      }
    }
  },
  apps: {
    crm_enterprise: {
      label: "\u4F01\u4E1A CRM",
      description: "\u6DB5\u76D6\u9500\u552E\u3001\u670D\u52A1\u548C\u5E02\u573A\u8425\u9500\u7684\u5BA2\u6237\u5173\u7CFB\u7BA1\u7406\u7CFB\u7EDF"
    }
  },
  messages: {
    "common.save": "\u4FDD\u5B58",
    "common.cancel": "\u53D6\u6D88",
    "common.delete": "\u5220\u9664",
    "common.edit": "\u7F16\u8F91",
    "common.create": "\u65B0\u5EFA",
    "common.search": "\u641C\u7D22",
    "common.filter": "\u7B5B\u9009",
    "common.export": "\u5BFC\u51FA",
    "common.back": "\u8FD4\u56DE",
    "common.confirm": "\u786E\u8BA4",
    "nav.sales": "\u9500\u552E",
    "nav.service": "\u670D\u52A1",
    "nav.marketing": "\u8425\u9500",
    "nav.products": "\u4EA7\u54C1",
    "nav.analytics": "\u6570\u636E\u5206\u6790",
    "success.saved": "\u8BB0\u5F55\u4FDD\u5B58\u6210\u529F",
    "success.converted": "\u7EBF\u7D22\u8F6C\u5316\u6210\u529F",
    "confirm.delete": "\u786E\u5B9A\u8981\u5220\u9664\u6B64\u8BB0\u5F55\u5417\uFF1F",
    "confirm.convert_lead": "\u5C06\u6B64\u7EBF\u7D22\u8F6C\u5316\u4E3A\u5BA2\u6237\u3001\u8054\u7CFB\u4EBA\u548C\u5546\u673A\uFF1F",
    "error.required": "\u6B64\u5B57\u6BB5\u4E3A\u5FC5\u586B\u9879",
    "error.load_failed": "\u6570\u636E\u52A0\u8F7D\u5931\u8D25"
  },
  validationMessages: {
    amount_required_for_closed: '\u9636\u6BB5\u4E3A"\u6210\u4EA4"\u65F6\uFF0C\u91D1\u989D\u4E3A\u5FC5\u586B\u9879',
    close_date_required: "\u5546\u673A\u5FC5\u987B\u586B\u5199\u9884\u8BA1\u6210\u4EA4\u65E5\u671F",
    discount_limit: "\u6298\u6263\u4E0D\u80FD\u8D85\u8FC740%"
  }
};

// ../app-crm/src/translations/ja-JP.ts
var jaJP = {
  objects: {
    account: {
      label: "\u53D6\u5F15\u5148",
      pluralLabel: "\u53D6\u5F15\u5148",
      fields: {
        account_number: { label: "\u53D6\u5F15\u5148\u756A\u53F7" },
        name: { label: "\u53D6\u5F15\u5148\u540D", help: "\u4F1A\u793E\u307E\u305F\u306F\u7D44\u7E54\u306E\u6B63\u5F0F\u540D\u79F0" },
        type: {
          label: "\u30BF\u30A4\u30D7",
          options: { prospect: "\u898B\u8FBC\u307F\u5BA2", customer: "\u9867\u5BA2", partner: "\u30D1\u30FC\u30C8\u30CA\u30FC", former: "\u904E\u53BB\u306E\u53D6\u5F15\u5148" }
        },
        industry: {
          label: "\u696D\u7A2E",
          options: {
            technology: "\u30C6\u30AF\u30CE\u30ED\u30B8\u30FC",
            finance: "\u91D1\u878D",
            healthcare: "\u30D8\u30EB\u30B9\u30B1\u30A2",
            retail: "\u5C0F\u58F2",
            manufacturing: "\u88FD\u9020",
            education: "\u6559\u80B2"
          }
        },
        annual_revenue: { label: "\u5E74\u9593\u58F2\u4E0A" },
        number_of_employees: { label: "\u5F93\u696D\u54E1\u6570" },
        phone: { label: "\u96FB\u8A71\u756A\u53F7" },
        website: { label: "Web\u30B5\u30A4\u30C8" },
        billing_address: { label: "\u8ACB\u6C42\u5148\u4F4F\u6240" },
        office_location: { label: "\u30AA\u30D5\u30A3\u30B9\u6240\u5728\u5730" },
        owner: { label: "\u53D6\u5F15\u5148\u8CAC\u4EFB\u8005" },
        parent_account: { label: "\u89AA\u53D6\u5F15\u5148" },
        description: { label: "\u8AAC\u660E" },
        is_active: { label: "\u6709\u52B9" },
        last_activity_date: { label: "\u6700\u7D42\u6D3B\u52D5\u65E5" }
      }
    },
    contact: {
      label: "\u53D6\u5F15\u5148\u8CAC\u4EFB\u8005",
      pluralLabel: "\u53D6\u5F15\u5148\u8CAC\u4EFB\u8005",
      fields: {
        salutation: { label: "\u656C\u79F0" },
        first_name: { label: "\u540D" },
        last_name: { label: "\u59D3" },
        full_name: { label: "\u6C0F\u540D" },
        account: { label: "\u53D6\u5F15\u5148" },
        email: { label: "\u30E1\u30FC\u30EB" },
        phone: { label: "\u96FB\u8A71" },
        mobile: { label: "\u643A\u5E2F\u96FB\u8A71" },
        title: { label: "\u5F79\u8077" },
        department: {
          label: "\u90E8\u9580",
          options: {
            Executive: "\u7D4C\u55B6\u5C64",
            Sales: "\u55B6\u696D\u90E8",
            Marketing: "\u30DE\u30FC\u30B1\u30C6\u30A3\u30F3\u30B0\u90E8",
            Engineering: "\u30A8\u30F3\u30B8\u30CB\u30A2\u30EA\u30F3\u30B0\u90E8",
            Support: "\u30B5\u30DD\u30FC\u30C8\u90E8",
            Finance: "\u7D4C\u7406\u90E8",
            HR: "\u4EBA\u4E8B\u90E8",
            Operations: "\u30AA\u30DA\u30EC\u30FC\u30B7\u30E7\u30F3\u90E8"
          }
        },
        owner: { label: "\u6240\u6709\u8005" },
        description: { label: "\u8AAC\u660E" },
        is_primary: { label: "\u4E3B\u62C5\u5F53\u8005" }
      }
    },
    lead: {
      label: "\u30EA\u30FC\u30C9",
      pluralLabel: "\u30EA\u30FC\u30C9",
      fields: {
        first_name: { label: "\u540D" },
        last_name: { label: "\u59D3" },
        company: { label: "\u4F1A\u793E\u540D" },
        title: { label: "\u5F79\u8077" },
        email: { label: "\u30E1\u30FC\u30EB" },
        phone: { label: "\u96FB\u8A71" },
        status: {
          label: "\u30B9\u30C6\u30FC\u30BF\u30B9",
          options: {
            new: "\u65B0\u898F",
            contacted: "\u30B3\u30F3\u30BF\u30AF\u30C8\u6E08\u307F",
            qualified: "\u9069\u683C",
            unqualified: "\u4E0D\u9069\u683C",
            converted: "\u53D6\u5F15\u958B\u59CB\u6E08\u307F"
          }
        },
        lead_source: {
          label: "\u30EA\u30FC\u30C9\u30BD\u30FC\u30B9",
          options: {
            Web: "Web",
            Referral: "\u7D39\u4ECB",
            Event: "\u30A4\u30D9\u30F3\u30C8",
            Partner: "\u30D1\u30FC\u30C8\u30CA\u30FC",
            Advertisement: "\u5E83\u544A",
            "Cold Call": "\u30B3\u30FC\u30EB\u30C9\u30B3\u30FC\u30EB"
          }
        },
        owner: { label: "\u30EA\u30FC\u30C9\u6240\u6709\u8005" },
        is_converted: { label: "\u53D6\u5F15\u958B\u59CB\u6E08\u307F" },
        description: { label: "\u8AAC\u660E" }
      }
    },
    opportunity: {
      label: "\u5546\u8AC7",
      pluralLabel: "\u5546\u8AC7",
      fields: {
        name: { label: "\u5546\u8AC7\u540D" },
        account: { label: "\u53D6\u5F15\u5148" },
        primary_contact: { label: "\u4E3B\u62C5\u5F53\u8005" },
        owner: { label: "\u5546\u8AC7\u6240\u6709\u8005" },
        amount: { label: "\u91D1\u984D" },
        expected_revenue: { label: "\u671F\u5F85\u53CE\u76CA" },
        stage: {
          label: "\u30D5\u30A7\u30FC\u30BA",
          options: {
            prospecting: "\u898B\u8FBC\u307F\u8ABF\u67FB",
            qualification: "\u9078\u5B9A",
            needs_analysis: "\u30CB\u30FC\u30BA\u5206\u6790",
            proposal: "\u63D0\u6848",
            negotiation: "\u4EA4\u6E09",
            closed_won: "\u6210\u7ACB",
            closed_lost: "\u4E0D\u6210\u7ACB"
          }
        },
        probability: { label: "\u78BA\u5EA6 (%)" },
        close_date: { label: "\u5B8C\u4E86\u4E88\u5B9A\u65E5" },
        type: {
          label: "\u30BF\u30A4\u30D7",
          options: {
            "New Business": "\u65B0\u898F\u30D3\u30B8\u30CD\u30B9",
            "Existing Customer - Upgrade": "\u65E2\u5B58\u9867\u5BA2 - \u30A2\u30C3\u30D7\u30B0\u30EC\u30FC\u30C9",
            "Existing Customer - Renewal": "\u65E2\u5B58\u9867\u5BA2 - \u66F4\u65B0",
            "Existing Customer - Expansion": "\u65E2\u5B58\u9867\u5BA2 - \u62E1\u5927"
          }
        },
        forecast_category: {
          label: "\u58F2\u4E0A\u4E88\u6E2C\u30AB\u30C6\u30B4\u30EA",
          options: {
            Pipeline: "\u30D1\u30A4\u30D7\u30E9\u30A4\u30F3",
            "Best Case": "\u6700\u826F\u30B1\u30FC\u30B9",
            Commit: "\u30B3\u30DF\u30C3\u30C8",
            Omitted: "\u9664\u5916",
            Closed: "\u5B8C\u4E86"
          }
        },
        description: { label: "\u8AAC\u660E" },
        next_step: { label: "\u6B21\u306E\u30B9\u30C6\u30C3\u30D7" }
      }
    }
  },
  apps: {
    crm_enterprise: {
      label: "\u30A8\u30F3\u30BF\u30FC\u30D7\u30E9\u30A4\u30BA CRM",
      description: "\u55B6\u696D\u30FB\u30B5\u30FC\u30D3\u30B9\u30FB\u30DE\u30FC\u30B1\u30C6\u30A3\u30F3\u30B0\u5411\u3051\u9867\u5BA2\u95A2\u4FC2\u7BA1\u7406\u30B7\u30B9\u30C6\u30E0"
    }
  },
  messages: {
    "common.save": "\u4FDD\u5B58",
    "common.cancel": "\u30AD\u30E3\u30F3\u30BB\u30EB",
    "common.delete": "\u524A\u9664",
    "common.edit": "\u7DE8\u96C6",
    "common.create": "\u65B0\u898F\u4F5C\u6210",
    "common.search": "\u691C\u7D22",
    "common.filter": "\u30D5\u30A3\u30EB\u30BF\u30FC",
    "common.export": "\u30A8\u30AF\u30B9\u30DD\u30FC\u30C8",
    "common.back": "\u623B\u308B",
    "common.confirm": "\u78BA\u8A8D",
    "nav.sales": "\u55B6\u696D",
    "nav.service": "\u30B5\u30FC\u30D3\u30B9",
    "nav.marketing": "\u30DE\u30FC\u30B1\u30C6\u30A3\u30F3\u30B0",
    "nav.products": "\u88FD\u54C1",
    "nav.analytics": "\u30A2\u30CA\u30EA\u30C6\u30A3\u30AF\u30B9",
    "success.saved": "\u30EC\u30B3\u30FC\u30C9\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F",
    "success.converted": "\u30EA\u30FC\u30C9\u3092\u53D6\u5F15\u958B\u59CB\u3057\u307E\u3057\u305F",
    "confirm.delete": "\u3053\u306E\u30EC\u30B3\u30FC\u30C9\u3092\u524A\u9664\u3057\u3066\u3082\u3088\u308D\u3057\u3044\u3067\u3059\u304B\uFF1F",
    "confirm.convert_lead": "\u3053\u306E\u30EA\u30FC\u30C9\u3092\u53D6\u5F15\u5148\u30FB\u53D6\u5F15\u5148\u8CAC\u4EFB\u8005\u30FB\u5546\u8AC7\u306B\u5909\u63DB\u3057\u307E\u3059\u304B\uFF1F",
    "error.required": "\u3053\u306E\u9805\u76EE\u306F\u5FC5\u9808\u3067\u3059",
    "error.load_failed": "\u30C7\u30FC\u30BF\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F"
  },
  validationMessages: {
    amount_required_for_closed: "\u30D5\u30A7\u30FC\u30BA\u304C\u300C\u6210\u7ACB\u300D\u306E\u5834\u5408\u3001\u91D1\u984D\u306F\u5FC5\u9808\u3067\u3059",
    close_date_required: "\u5546\u8AC7\u306B\u306F\u5B8C\u4E86\u4E88\u5B9A\u65E5\u304C\u5FC5\u8981\u3067\u3059",
    discount_limit: "\u5272\u5F15\u306F40%\u3092\u8D85\u3048\u308B\u3053\u3068\u306F\u3067\u304D\u307E\u305B\u3093"
  }
};

// ../app-crm/src/translations/es-ES.ts
var esES = {
  objects: {
    account: {
      label: "Cuenta",
      pluralLabel: "Cuentas",
      fields: {
        account_number: { label: "N\xFAmero de Cuenta" },
        name: { label: "Nombre de Cuenta", help: "Nombre legal de la empresa u organizaci\xF3n" },
        type: {
          label: "Tipo",
          options: { prospect: "Prospecto", customer: "Cliente", partner: "Socio", former: "Anterior" }
        },
        industry: {
          label: "Industria",
          options: {
            technology: "Tecnolog\xEDa",
            finance: "Finanzas",
            healthcare: "Salud",
            retail: "Comercio",
            manufacturing: "Manufactura",
            education: "Educaci\xF3n"
          }
        },
        annual_revenue: { label: "Ingresos Anuales" },
        number_of_employees: { label: "N\xFAmero de Empleados" },
        phone: { label: "Tel\xE9fono" },
        website: { label: "Sitio Web" },
        billing_address: { label: "Direcci\xF3n de Facturaci\xF3n" },
        office_location: { label: "Ubicaci\xF3n de Oficina" },
        owner: { label: "Propietario de Cuenta" },
        parent_account: { label: "Cuenta Matriz" },
        description: { label: "Descripci\xF3n" },
        is_active: { label: "Activo" },
        last_activity_date: { label: "Fecha de \xDAltima Actividad" }
      }
    },
    contact: {
      label: "Contacto",
      pluralLabel: "Contactos",
      fields: {
        salutation: { label: "T\xEDtulo" },
        first_name: { label: "Nombre" },
        last_name: { label: "Apellido" },
        full_name: { label: "Nombre Completo" },
        account: { label: "Cuenta" },
        email: { label: "Correo Electr\xF3nico" },
        phone: { label: "Tel\xE9fono" },
        mobile: { label: "M\xF3vil" },
        title: { label: "Cargo" },
        department: {
          label: "Departamento",
          options: {
            Executive: "Ejecutivo",
            Sales: "Ventas",
            Marketing: "Marketing",
            Engineering: "Ingenier\xEDa",
            Support: "Soporte",
            Finance: "Finanzas",
            HR: "Recursos Humanos",
            Operations: "Operaciones"
          }
        },
        owner: { label: "Propietario de Contacto" },
        description: { label: "Descripci\xF3n" },
        is_primary: { label: "Contacto Principal" }
      }
    },
    lead: {
      label: "Prospecto",
      pluralLabel: "Prospectos",
      fields: {
        first_name: { label: "Nombre" },
        last_name: { label: "Apellido" },
        company: { label: "Empresa" },
        title: { label: "Cargo" },
        email: { label: "Correo Electr\xF3nico" },
        phone: { label: "Tel\xE9fono" },
        status: {
          label: "Estado",
          options: {
            new: "Nuevo",
            contacted: "Contactado",
            qualified: "Calificado",
            unqualified: "No Calificado",
            converted: "Convertido"
          }
        },
        lead_source: {
          label: "Origen del Prospecto",
          options: {
            Web: "Web",
            Referral: "Referencia",
            Event: "Evento",
            Partner: "Socio",
            Advertisement: "Publicidad",
            "Cold Call": "Llamada en Fr\xEDo"
          }
        },
        owner: { label: "Propietario" },
        is_converted: { label: "Convertido" },
        description: { label: "Descripci\xF3n" }
      }
    },
    opportunity: {
      label: "Oportunidad",
      pluralLabel: "Oportunidades",
      fields: {
        name: { label: "Nombre de Oportunidad" },
        account: { label: "Cuenta" },
        primary_contact: { label: "Contacto Principal" },
        owner: { label: "Propietario de Oportunidad" },
        amount: { label: "Monto" },
        expected_revenue: { label: "Ingreso Esperado" },
        stage: {
          label: "Etapa",
          options: {
            prospecting: "Prospecci\xF3n",
            qualification: "Calificaci\xF3n",
            needs_analysis: "An\xE1lisis de Necesidades",
            proposal: "Propuesta",
            negotiation: "Negociaci\xF3n",
            closed_won: "Cerrada Ganada",
            closed_lost: "Cerrada Perdida"
          }
        },
        probability: { label: "Probabilidad (%)" },
        close_date: { label: "Fecha de Cierre" },
        type: {
          label: "Tipo",
          options: {
            "New Business": "Nuevo Negocio",
            "Existing Customer - Upgrade": "Cliente Existente - Mejora",
            "Existing Customer - Renewal": "Cliente Existente - Renovaci\xF3n",
            "Existing Customer - Expansion": "Cliente Existente - Expansi\xF3n"
          }
        },
        forecast_category: {
          label: "Categor\xEDa de Pron\xF3stico",
          options: {
            Pipeline: "Pipeline",
            "Best Case": "Mejor Caso",
            Commit: "Compromiso",
            Omitted: "Omitida",
            Closed: "Cerrada"
          }
        },
        description: { label: "Descripci\xF3n" },
        next_step: { label: "Pr\xF3ximo Paso" }
      }
    }
  },
  apps: {
    crm_enterprise: {
      label: "CRM Empresarial",
      description: "Gesti\xF3n de relaciones con clientes para ventas, servicio y marketing"
    }
  },
  messages: {
    "common.save": "Guardar",
    "common.cancel": "Cancelar",
    "common.delete": "Eliminar",
    "common.edit": "Editar",
    "common.create": "Crear",
    "common.search": "Buscar",
    "common.filter": "Filtrar",
    "common.export": "Exportar",
    "common.back": "Volver",
    "common.confirm": "Confirmar",
    "nav.sales": "Ventas",
    "nav.service": "Servicio",
    "nav.marketing": "Marketing",
    "nav.products": "Productos",
    "nav.analytics": "Anal\xEDtica",
    "success.saved": "Registro guardado exitosamente",
    "success.converted": "Prospecto convertido exitosamente",
    "confirm.delete": "\xBFEst\xE1 seguro de que desea eliminar este registro?",
    "confirm.convert_lead": "\xBFConvertir este prospecto en cuenta, contacto y oportunidad?",
    "error.required": "Este campo es obligatorio",
    "error.load_failed": "Error al cargar los datos"
  },
  validationMessages: {
    amount_required_for_closed: "El monto es obligatorio cuando la etapa es Cerrada Ganada",
    close_date_required: "La fecha de cierre es obligatoria para las oportunidades",
    discount_limit: "El descuento no puede superar el 40%"
  }
};

// ../app-crm/src/translations/crm.translation.ts
var CrmTranslations = {
  en,
  "zh-CN": zhCN,
  "ja-JP": jaJP,
  "es-ES": esES
};

// ../app-crm/src/data/index.ts
var accounts = {
  object: "account",
  mode: "upsert",
  externalId: "name",
  records: [
    {
      name: "Acme Corporation",
      type: "customer",
      industry: "technology",
      annual_revenue: 5e6,
      number_of_employees: 250,
      phone: "+1-415-555-0100",
      website: "https://acme.example.com"
    },
    {
      name: "Globex Industries",
      type: "prospect",
      industry: "manufacturing",
      annual_revenue: 12e6,
      number_of_employees: 800,
      phone: "+1-312-555-0200",
      website: "https://globex.example.com"
    },
    {
      name: "Initech Solutions",
      type: "customer",
      industry: "finance",
      annual_revenue: 35e5,
      number_of_employees: 150,
      phone: "+1-212-555-0300",
      website: "https://initech.example.com"
    },
    {
      name: "Stark Medical",
      type: "partner",
      industry: "healthcare",
      annual_revenue: 8e6,
      number_of_employees: 400,
      phone: "+1-617-555-0400",
      website: "https://starkmed.example.com"
    },
    {
      name: "Wayne Enterprises",
      type: "customer",
      industry: "technology",
      annual_revenue: 25e6,
      number_of_employees: 2e3,
      phone: "+1-650-555-0500",
      website: "https://wayne.example.com"
    }
  ]
};
var contacts = {
  object: "contact",
  mode: "upsert",
  externalId: "email",
  records: [
    {
      salutation: "Mr.",
      first_name: "John",
      last_name: "Smith",
      email: "john.smith@acme.example.com",
      phone: "+1-415-555-0101",
      title: "VP of Engineering",
      department: "Engineering"
    },
    {
      salutation: "Ms.",
      first_name: "Sarah",
      last_name: "Johnson",
      email: "sarah.j@globex.example.com",
      phone: "+1-312-555-0201",
      title: "Chief Procurement Officer",
      department: "Executive"
    },
    {
      salutation: "Dr.",
      first_name: "Michael",
      last_name: "Chen",
      email: "mchen@initech.example.com",
      phone: "+1-212-555-0301",
      title: "Director of Operations",
      department: "Operations"
    },
    {
      salutation: "Ms.",
      first_name: "Emily",
      last_name: "Davis",
      email: "emily.d@starkmed.example.com",
      phone: "+1-617-555-0401",
      title: "Head of Partnerships",
      department: "Sales"
    },
    {
      salutation: "Mr.",
      first_name: "Robert",
      last_name: "Wilson",
      email: "rwilson@wayne.example.com",
      phone: "+1-650-555-0501",
      title: "CTO",
      department: "Engineering"
    }
  ]
};
var leads = {
  object: "lead",
  mode: "upsert",
  externalId: "email",
  records: [
    {
      first_name: "Alice",
      last_name: "Martinez",
      company: "NextGen Retail",
      email: "alice@nextgenretail.example.com",
      phone: "+1-503-555-0600",
      status: "new",
      source: "website",
      industry: "Retail"
    },
    {
      first_name: "David",
      last_name: "Kim",
      company: "EduTech Labs",
      email: "dkim@edutechlabs.example.com",
      phone: "+1-408-555-0700",
      status: "contacted",
      source: "referral",
      industry: "Education"
    },
    {
      first_name: "Lisa",
      last_name: "Thompson",
      company: "CloudFirst Inc",
      email: "lisa.t@cloudfirst.example.com",
      phone: "+1-206-555-0800",
      status: "qualified",
      source: "trade_show",
      industry: "Technology"
    }
  ]
};
var opportunities = {
  object: "opportunity",
  mode: "upsert",
  externalId: "name",
  records: [
    {
      name: "Acme Platform Upgrade",
      amount: 15e4,
      stage: "proposal",
      probability: 60,
      close_date: new Date(Date.now() + 864e5 * 30),
      type: "existing_business",
      forecast_category: "pipeline"
    },
    {
      name: "Globex Manufacturing Suite",
      amount: 5e5,
      stage: "qualification",
      probability: 30,
      close_date: new Date(Date.now() + 864e5 * 60),
      type: "new_business",
      forecast_category: "pipeline"
    },
    {
      name: "Wayne Enterprise License",
      amount: 12e5,
      stage: "negotiation",
      probability: 75,
      close_date: new Date(Date.now() + 864e5 * 14),
      type: "new_business",
      forecast_category: "commit"
    },
    {
      name: "Initech Cloud Migration",
      amount: 8e4,
      stage: "needs_analysis",
      probability: 25,
      close_date: new Date(Date.now() + 864e5 * 45),
      type: "existing_business",
      forecast_category: "best_case"
    }
  ]
};
var products = {
  object: "product",
  mode: "upsert",
  externalId: "name",
  records: [
    {
      name: "ObjectStack Platform",
      category: "software",
      family: "enterprise",
      list_price: 5e4,
      is_active: true
    },
    {
      name: "Cloud Hosting (Annual)",
      category: "subscription",
      family: "cloud",
      list_price: 12e3,
      is_active: true
    },
    {
      name: "Premium Support",
      category: "support",
      family: "services",
      list_price: 25e3,
      is_active: true
    },
    {
      name: "Implementation Services",
      category: "service",
      family: "services",
      list_price: 75e3,
      is_active: true
    }
  ]
};
var tasks = {
  object: "task",
  mode: "upsert",
  externalId: "subject",
  records: [
    {
      subject: "Follow up with Acme on proposal",
      status: "not_started",
      priority: "high",
      due_date: new Date(Date.now() + 864e5 * 2)
    },
    {
      subject: "Schedule demo for Globex team",
      status: "in_progress",
      priority: "normal",
      due_date: new Date(Date.now() + 864e5 * 5)
    },
    {
      subject: "Prepare contract for Wayne Enterprises",
      status: "not_started",
      priority: "urgent",
      due_date: new Date(Date.now() + 864e5)
    },
    {
      subject: "Send welcome package to Stark Medical",
      status: "completed",
      priority: "low"
    },
    {
      subject: "Update CRM pipeline report",
      status: "not_started",
      priority: "normal",
      due_date: new Date(Date.now() + 864e5 * 7)
    }
  ]
};
var CrmSeedData = [
  accounts,
  contacts,
  leads,
  opportunities,
  products,
  tasks
];

// ../app-crm/src/sharing/account.sharing.ts
var AccountTeamSharingRule = {
  name: "account_team_sharing",
  label: "Account Team Sharing",
  object: "account",
  type: "criteria",
  condition: 'type = "customer" AND is_active = true',
  accessLevel: "edit",
  sharedWith: { type: "role", value: "sales_manager" }
};
var TerritorySharingRules = [
  {
    name: "north_america_territory",
    label: "North America Territory",
    object: "account",
    type: "criteria",
    condition: 'billing_country IN ("US", "CA", "MX")',
    accessLevel: "edit",
    sharedWith: { type: "role", value: "na_sales_team" }
  },
  {
    name: "europe_territory",
    label: "Europe Territory",
    object: "account",
    type: "criteria",
    condition: 'billing_country IN ("UK", "DE", "FR", "IT", "ES")',
    accessLevel: "edit",
    sharedWith: { type: "role", value: "eu_sales_team" }
  }
];

// ../app-crm/src/sharing/case.sharing.ts
var CaseEscalationSharingRule = {
  name: "case_escalation_sharing",
  label: "Escalated Cases Sharing",
  object: "case",
  type: "criteria",
  condition: 'priority = "critical" AND is_closed = false',
  accessLevel: "edit",
  sharedWith: { type: "role_and_subordinates", value: "service_manager" }
};

// ../app-crm/src/sharing/defaults.sharing.ts
var OrganizationDefaults = {
  lead: { internalAccess: "private", externalAccess: "private" },
  account: { internalAccess: "private", externalAccess: "private" },
  contact: { internalAccess: "controlled_by_parent", externalAccess: "private" },
  opportunity: { internalAccess: "private", externalAccess: "private" },
  case: { internalAccess: "private", externalAccess: "private" },
  campaign: { internalAccess: "public_read_only", externalAccess: "private" },
  product: { internalAccess: "public_read_only", externalAccess: "private" },
  task: { internalAccess: "private", externalAccess: "private" }
};

// ../app-crm/src/sharing/opportunity.sharing.ts
var OpportunitySalesSharingRule = {
  name: "opportunity_sales_sharing",
  label: "Opportunity Sales Team Sharing",
  object: "opportunity",
  type: "criteria",
  condition: 'stage NOT IN ("closed_won", "closed_lost") AND amount >= 100000',
  accessLevel: "read",
  sharedWith: { type: "role_and_subordinates", value: "sales_director" }
};

// ../app-crm/src/sharing/role-hierarchy.ts
var RoleHierarchy = {
  name: "crm_role_hierarchy",
  label: "CRM Role Hierarchy",
  roles: [
    { name: "executive", label: "Executive", parentRole: null },
    { name: "sales_director", label: "Sales Director", parentRole: "executive" },
    { name: "sales_manager", label: "Sales Manager", parentRole: "sales_director" },
    { name: "sales_rep", label: "Sales Representative", parentRole: "sales_manager" },
    { name: "service_director", label: "Service Director", parentRole: "executive" },
    { name: "service_manager", label: "Service Manager", parentRole: "service_director" },
    { name: "service_agent", label: "Service Agent", parentRole: "service_manager" },
    { name: "marketing_director", label: "Marketing Director", parentRole: "executive" },
    { name: "marketing_manager", label: "Marketing Manager", parentRole: "marketing_director" },
    { name: "marketing_user", label: "Marketing User", parentRole: "marketing_manager" }
  ]
};

// ../app-crm/objectstack.config.ts
var objectstack_config_default = defineStack({
  manifest: {
    id: "com.example.crm",
    namespace: "crm",
    version: "3.0.0",
    type: "app",
    name: "Enterprise CRM",
    description: "Comprehensive enterprise CRM demonstrating all ObjectStack Protocol features including AI, security, and automation"
  },
  // Auto-collected from barrel index files via Object.values()
  objects: Object.values(objects_exports),
  apis: Object.values(apis_exports),
  actions: Object.values(actions_exports),
  dashboards: Object.values(dashboards_exports),
  reports: Object.values(reports_exports),
  flows: Object.values(flows_exports),
  agents: Object.values(agents_exports),
  ragPipelines: Object.values(rag_exports),
  profiles: Object.values(profiles_exports),
  apps: Object.values(apps_exports),
  interfaces: Object.values(interfaces),
  // Seed Data (top-level, registered as metadata)
  data: CrmSeedData,
  // I18n Configuration — per-locale file organization
  i18n: {
    defaultLocale: "en",
    supportedLocales: ["en", "zh-CN", "ja-JP", "es-ES"],
    fallbackLocale: "en",
    fileOrganization: "per_locale"
  },
  // I18n Translation Bundles (en, zh-CN, ja-JP, es-ES)
  translations: Object.values(translations_exports),
  // Sharing & security (requires explicit wiring)
  sharingRules: [
    AccountTeamSharingRule,
    OpportunitySalesSharingRule,
    CaseEscalationSharingRule,
    ...TerritorySharingRules
  ],
  roleHierarchy: RoleHierarchy,
  organizationDefaults: OrganizationDefaults
});

// ../app-todo/objectstack.config.ts
import { defineStack as defineStack2 } from "@objectstack/spec";

// ../app-todo/src/objects/index.ts
var objects_exports2 = {};
__export(objects_exports2, {
  Task: () => Task2
});

// ../app-todo/src/objects/task.object.ts
import { ObjectSchema as ObjectSchema11, Field as Field11 } from "@objectstack/spec/data";
var Task2 = ObjectSchema11.create({
  name: "task",
  label: "Task",
  pluralLabel: "Tasks",
  icon: "check-square",
  description: "Personal tasks and to-do items",
  fields: {
    // Task Information
    subject: Field11.text({
      label: "Subject",
      required: true,
      searchable: true,
      maxLength: 255
    }),
    description: Field11.markdown({
      label: "Description"
    }),
    // Task Management
    status: {
      type: "select",
      label: "Status",
      required: true,
      options: [
        { label: "Not Started", value: "not_started", color: "#808080", default: true },
        { label: "In Progress", value: "in_progress", color: "#3B82F6" },
        { label: "Waiting", value: "waiting", color: "#F59E0B" },
        { label: "Completed", value: "completed", color: "#10B981" },
        { label: "Deferred", value: "deferred", color: "#6B7280" }
      ]
    },
    priority: {
      type: "select",
      label: "Priority",
      required: true,
      options: [
        { label: "Low", value: "low", color: "#60A5FA", default: true },
        { label: "Normal", value: "normal", color: "#10B981" },
        { label: "High", value: "high", color: "#F59E0B" },
        { label: "Urgent", value: "urgent", color: "#EF4444" }
      ]
    },
    category: Field11.select(["Personal", "Work", "Shopping", "Health", "Finance", "Other"], {
      label: "Category"
    }),
    // Dates
    due_date: Field11.date({
      label: "Due Date"
    }),
    reminder_date: Field11.datetime({
      label: "Reminder Date/Time"
    }),
    completed_date: Field11.datetime({
      label: "Completed Date",
      readonly: true
    }),
    // Assignment
    owner: Field11.lookup("user", {
      label: "Assigned To",
      required: true
    }),
    // Tags
    tags: {
      type: "select",
      label: "Tags",
      multiple: true,
      options: [
        { label: "Important", value: "important", color: "#EF4444" },
        { label: "Quick Win", value: "quick_win", color: "#10B981" },
        { label: "Blocked", value: "blocked", color: "#F59E0B" },
        { label: "Follow Up", value: "follow_up", color: "#3B82F6" },
        { label: "Review", value: "review", color: "#8B5CF6" }
      ]
    },
    // Recurrence
    is_recurring: Field11.boolean({
      label: "Recurring Task",
      defaultValue: false
    }),
    recurrence_type: Field11.select(["Daily", "Weekly", "Monthly", "Yearly"], {
      label: "Recurrence Type"
    }),
    recurrence_interval: Field11.number({
      label: "Recurrence Interval",
      defaultValue: 1,
      min: 1
    }),
    // Flags
    is_completed: Field11.boolean({
      label: "Is Completed",
      defaultValue: false,
      readonly: true
    }),
    is_overdue: Field11.boolean({
      label: "Is Overdue",
      defaultValue: false,
      readonly: true
    }),
    // Progress
    progress_percent: Field11.percent({
      label: "Progress (%)",
      min: 0,
      max: 100,
      defaultValue: 0
    }),
    // Time Tracking
    estimated_hours: Field11.number({
      label: "Estimated Hours",
      scale: 2,
      min: 0
    }),
    actual_hours: Field11.number({
      label: "Actual Hours",
      scale: 2,
      min: 0
    }),
    // Additional fields
    notes: Field11.richtext({
      label: "Notes",
      description: "Rich text notes with formatting"
    }),
    category_color: Field11.color({
      label: "Category Color",
      colorFormat: "hex",
      presetColors: ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6"]
    })
  },
  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    files: true,
    feeds: true,
    activities: true,
    trash: true,
    mru: true
  },
  titleFormat: "{subject}",
  compactLayout: ["subject", "status", "priority", "due_date", "owner"],
  validations: [
    {
      name: "completed_date_required",
      type: "script",
      severity: "error",
      message: "Completed date is required when status is Completed",
      condition: 'status = "completed" AND ISBLANK(completed_date)'
    },
    {
      name: "recurrence_fields_required",
      type: "script",
      severity: "error",
      message: "Recurrence type is required for recurring tasks",
      condition: "is_recurring = true AND ISBLANK(recurrence_type)"
    }
  ],
  workflows: [
    {
      name: "set_completed_flag",
      objectName: "task",
      triggerType: "on_create_or_update",
      criteria: "ISCHANGED(status)",
      active: true,
      actions: [
        {
          name: "update_completed_flag",
          type: "field_update",
          field: "is_completed",
          value: 'status = "completed"'
        }
      ]
    },
    {
      name: "set_completed_date",
      objectName: "task",
      triggerType: "on_update",
      criteria: 'ISCHANGED(status) AND status = "completed"',
      active: true,
      actions: [
        {
          name: "set_date",
          type: "field_update",
          field: "completed_date",
          value: "NOW()"
        },
        {
          name: "set_progress",
          type: "field_update",
          field: "progress_percent",
          value: "100"
        }
      ]
    },
    {
      name: "check_overdue",
      objectName: "task",
      triggerType: "on_create_or_update",
      criteria: "due_date < TODAY() AND is_completed = false",
      active: true,
      actions: [
        {
          name: "set_overdue_flag",
          type: "field_update",
          field: "is_overdue",
          value: "true"
        }
      ]
    },
    {
      name: "notify_on_urgent",
      objectName: "task",
      triggerType: "on_create_or_update",
      criteria: 'priority = "urgent" AND is_completed = false',
      active: true,
      actions: [
        {
          name: "email_owner",
          type: "email_alert",
          template: "urgent_task_alert",
          recipients: ["{owner.email}"]
        }
      ]
    }
  ]
});

// ../app-todo/src/actions/index.ts
var actions_exports2 = {};
__export(actions_exports2, {
  CloneTaskAction: () => CloneTaskAction,
  CompleteTaskAction: () => CompleteTaskAction,
  DeferTaskAction: () => DeferTaskAction,
  DeleteCompletedAction: () => DeleteCompletedAction,
  ExportToCsvAction: () => ExportToCsvAction2,
  MassCompleteTasksAction: () => MassCompleteTasksAction,
  SetReminderAction: () => SetReminderAction,
  StartTaskAction: () => StartTaskAction
});

// ../app-todo/src/actions/task.actions.ts
var CompleteTaskAction = {
  name: "complete_task",
  label: "Mark Complete",
  objectName: "task",
  icon: "check-circle",
  type: "script",
  target: "completeTask",
  locations: ["record_header", "list_item"],
  successMessage: "Task marked as complete!",
  refreshAfter: true
};
var StartTaskAction = {
  name: "start_task",
  label: "Start Task",
  objectName: "task",
  icon: "play-circle",
  type: "script",
  target: "startTask",
  locations: ["record_header", "list_item"],
  successMessage: "Task started!",
  refreshAfter: true
};
var DeferTaskAction = {
  name: "defer_task",
  label: "Defer Task",
  objectName: "task",
  icon: "clock",
  type: "modal",
  target: "defer_task_modal",
  locations: ["record_header"],
  params: [
    {
      name: "new_due_date",
      label: "New Due Date",
      type: "date",
      required: true
    },
    {
      name: "reason",
      label: "Reason for Deferral",
      type: "textarea",
      required: false
    }
  ],
  successMessage: "Task deferred successfully!",
  refreshAfter: true
};
var SetReminderAction = {
  name: "set_reminder",
  label: "Set Reminder",
  objectName: "task",
  icon: "bell",
  type: "modal",
  target: "set_reminder_modal",
  locations: ["record_header", "list_item"],
  params: [
    {
      name: "reminder_date",
      label: "Reminder Date/Time",
      type: "datetime",
      required: true
    }
  ],
  successMessage: "Reminder set!",
  refreshAfter: true
};
var CloneTaskAction = {
  name: "clone_task",
  label: "Clone Task",
  objectName: "task",
  icon: "copy",
  type: "script",
  target: "cloneTask",
  locations: ["record_header"],
  successMessage: "Task cloned successfully!",
  refreshAfter: true
};
var MassCompleteTasksAction = {
  name: "mass_complete",
  label: "Complete Selected",
  objectName: "task",
  icon: "check-square",
  type: "script",
  target: "massCompleteTasks",
  locations: ["list_toolbar"],
  successMessage: "Selected tasks marked as complete!",
  refreshAfter: true
};
var DeleteCompletedAction = {
  name: "delete_completed",
  label: "Delete Completed",
  objectName: "task",
  icon: "trash-2",
  type: "script",
  target: "deleteCompletedTasks",
  locations: ["list_toolbar"],
  successMessage: "Completed tasks deleted!",
  refreshAfter: true
};
var ExportToCsvAction2 = {
  name: "export_csv",
  label: "Export to CSV",
  objectName: "task",
  icon: "download",
  type: "script",
  target: "exportTasksToCSV",
  locations: ["list_toolbar"],
  successMessage: "Export completed!",
  refreshAfter: false
};

// ../app-todo/src/dashboards/index.ts
var dashboards_exports2 = {};
__export(dashboards_exports2, {
  TaskDashboard: () => TaskDashboard
});

// ../app-todo/src/dashboards/task.dashboard.ts
var TaskDashboard = {
  name: "task_dashboard",
  label: "Task Overview",
  description: "Key task metrics and productivity overview",
  widgets: [
    // Row 1: Key Metrics
    {
      id: "total_tasks",
      title: "Total Tasks",
      type: "metric",
      object: "task",
      aggregate: "count",
      layout: { x: 0, y: 0, w: 3, h: 2 },
      options: { color: "#3B82F6" }
    },
    {
      id: "completed_today",
      title: "Completed Today",
      type: "metric",
      object: "task",
      filter: { is_completed: true, completed_date: { $gte: "{today_start}" } },
      aggregate: "count",
      layout: { x: 3, y: 0, w: 3, h: 2 },
      options: { color: "#10B981" }
    },
    {
      id: "overdue_tasks",
      title: "Overdue Tasks",
      type: "metric",
      object: "task",
      filter: { is_overdue: true, is_completed: false },
      aggregate: "count",
      layout: { x: 6, y: 0, w: 3, h: 2 },
      options: { color: "#EF4444" }
    },
    {
      id: "completion_rate",
      title: "Completion Rate",
      type: "metric",
      object: "task",
      filter: { created_date: { $gte: "{current_week_start}" } },
      valueField: "is_completed",
      aggregate: "count",
      layout: { x: 9, y: 0, w: 3, h: 2 },
      options: { suffix: "%", color: "#8B5CF6" }
    },
    // Row 2: Task Distribution
    {
      id: "tasks_by_status",
      title: "Tasks by Status",
      type: "pie",
      object: "task",
      filter: { is_completed: false },
      categoryField: "status",
      aggregate: "count",
      layout: { x: 0, y: 2, w: 6, h: 4 },
      options: { showLegend: true }
    },
    {
      id: "tasks_by_priority",
      title: "Tasks by Priority",
      type: "bar",
      object: "task",
      filter: { is_completed: false },
      categoryField: "priority",
      aggregate: "count",
      layout: { x: 6, y: 2, w: 6, h: 4 },
      options: { horizontal: true }
    },
    // Row 3: Trends
    {
      id: "weekly_task_completion",
      title: "Weekly Task Completion",
      type: "line",
      object: "task",
      filter: { is_completed: true, completed_date: { $gte: "{last_4_weeks}" } },
      categoryField: "completed_date",
      aggregate: "count",
      layout: { x: 0, y: 6, w: 8, h: 4 },
      options: { showDataLabels: true }
    },
    {
      id: "tasks_by_category",
      title: "Tasks by Category",
      type: "donut",
      object: "task",
      filter: { is_completed: false },
      categoryField: "category",
      aggregate: "count",
      layout: { x: 8, y: 6, w: 4, h: 4 },
      options: { showLegend: true }
    },
    // Row 4: Tables
    {
      id: "overdue_tasks_table",
      title: "Overdue Tasks",
      type: "table",
      object: "task",
      filter: { is_overdue: true, is_completed: false },
      aggregate: "count",
      layout: { x: 0, y: 10, w: 6, h: 4 }
    },
    {
      id: "due_today",
      title: "Due Today",
      type: "table",
      object: "task",
      filter: { due_date: "{today}", is_completed: false },
      aggregate: "count",
      layout: { x: 6, y: 10, w: 6, h: 4 }
    }
  ]
};

// ../app-todo/src/reports/index.ts
var reports_exports2 = {};
__export(reports_exports2, {
  CompletedTasksReport: () => CompletedTasksReport,
  OverdueTasksReport: () => OverdueTasksReport,
  TasksByOwnerReport: () => TasksByOwnerReport2,
  TasksByPriorityReport: () => TasksByPriorityReport,
  TasksByStatusReport: () => TasksByStatusReport,
  TimeTrackingReport: () => TimeTrackingReport
});

// ../app-todo/src/reports/task.report.ts
var TasksByStatusReport = {
  name: "tasks_by_status",
  label: "Tasks by Status",
  description: "Summary of tasks grouped by status",
  objectName: "task",
  type: "summary",
  columns: [
    { field: "subject", label: "Subject" },
    { field: "priority", label: "Priority" },
    { field: "due_date", label: "Due Date" },
    { field: "owner", label: "Assigned To" }
  ],
  groupingsDown: [{ field: "status", sortOrder: "asc" }]
};
var TasksByPriorityReport = {
  name: "tasks_by_priority",
  label: "Tasks by Priority",
  description: "Summary of tasks grouped by priority level",
  objectName: "task",
  type: "summary",
  columns: [
    { field: "subject", label: "Subject" },
    { field: "status", label: "Status" },
    { field: "due_date", label: "Due Date" },
    { field: "category", label: "Category" }
  ],
  groupingsDown: [{ field: "priority", sortOrder: "desc" }],
  filter: { is_completed: false }
};
var TasksByOwnerReport2 = {
  name: "tasks_by_owner",
  label: "Tasks by Owner",
  description: "Task summary by assignee",
  objectName: "task",
  type: "summary",
  columns: [
    { field: "subject", label: "Subject" },
    { field: "status", label: "Status" },
    { field: "priority", label: "Priority" },
    { field: "due_date", label: "Due Date" },
    { field: "estimated_hours", label: "Est. Hours", aggregate: "sum" },
    { field: "actual_hours", label: "Actual Hours", aggregate: "sum" }
  ],
  groupingsDown: [{ field: "owner", sortOrder: "asc" }],
  filter: { is_completed: false }
};
var OverdueTasksReport = {
  name: "overdue_tasks",
  label: "Overdue Tasks",
  description: "All overdue tasks that need attention",
  objectName: "task",
  type: "tabular",
  columns: [
    { field: "subject", label: "Subject" },
    { field: "due_date", label: "Due Date" },
    { field: "priority", label: "Priority" },
    { field: "owner", label: "Assigned To" },
    { field: "category", label: "Category" }
  ],
  filter: { is_overdue: true, is_completed: false }
};
var CompletedTasksReport = {
  name: "completed_tasks",
  label: "Completed Tasks",
  description: "All completed tasks with time tracking",
  objectName: "task",
  type: "summary",
  columns: [
    { field: "subject", label: "Subject" },
    { field: "completed_date", label: "Completed Date" },
    { field: "estimated_hours", label: "Est. Hours", aggregate: "sum" },
    { field: "actual_hours", label: "Actual Hours", aggregate: "sum" }
  ],
  groupingsDown: [{ field: "category", sortOrder: "asc" }],
  filter: { is_completed: true }
};
var TimeTrackingReport = {
  name: "time_tracking",
  label: "Time Tracking Report",
  description: "Estimated vs actual hours analysis",
  objectName: "task",
  type: "matrix",
  columns: [
    { field: "estimated_hours", label: "Estimated Hours", aggregate: "sum" },
    { field: "actual_hours", label: "Actual Hours", aggregate: "sum" }
  ],
  groupingsDown: [{ field: "owner", sortOrder: "asc" }],
  groupingsAcross: [{ field: "category", sortOrder: "asc" }],
  filter: { is_completed: true }
};

// ../app-todo/src/flows/index.ts
var flows_exports2 = {};
__export(flows_exports2, {
  OverdueEscalationFlow: () => OverdueEscalationFlow,
  QuickAddTaskFlow: () => QuickAddTaskFlow,
  TaskCompletionFlow: () => TaskCompletionFlow,
  TaskReminderFlow: () => TaskReminderFlow
});

// ../app-todo/src/flows/task.flow.ts
var TaskReminderFlow = {
  name: "task_reminder",
  label: "Task Reminder Notification",
  description: "Automated flow to send reminders for tasks approaching their due date",
  type: "schedule",
  variables: [
    { name: "tasksToRemind", type: "record_collection", isInput: false, isOutput: false }
  ],
  nodes: [
    { id: "start", type: "start", label: "Start (Daily 8 AM)", config: { schedule: "0 8 * * *", objectName: "task" } },
    {
      id: "get_upcoming_tasks",
      type: "get_record",
      label: "Get Tasks Due Tomorrow",
      config: { objectName: "task", filter: { due_date: "{tomorrow}", is_completed: false }, outputVariable: "tasksToRemind", getAll: true }
    },
    {
      id: "loop_tasks",
      type: "loop",
      label: "Loop Through Tasks",
      config: { collection: "{tasksToRemind}", iteratorVariable: "currentTask" }
    },
    {
      id: "send_reminder",
      type: "script",
      label: "Send Reminder Email",
      config: {
        actionType: "email",
        inputs: {
          to: "{currentTask.owner.email}",
          subject: "Task Due Tomorrow: {currentTask.subject}",
          template: "task_reminder_email",
          data: { taskSubject: "{currentTask.subject}", dueDate: "{currentTask.due_date}", priority: "{currentTask.priority}" }
        }
      }
    },
    { id: "end", type: "end", label: "End" }
  ],
  edges: [
    { id: "e1", source: "start", target: "get_upcoming_tasks", type: "default" },
    { id: "e2", source: "get_upcoming_tasks", target: "loop_tasks", type: "default" },
    { id: "e3", source: "loop_tasks", target: "send_reminder", type: "default" },
    { id: "e4", source: "send_reminder", target: "end", type: "default" }
  ]
};
var OverdueEscalationFlow = {
  name: "overdue_escalation",
  label: "Overdue Task Escalation",
  description: "Escalates tasks that have been overdue for more than 3 days",
  type: "schedule",
  variables: [
    { name: "overdueTasks", type: "record_collection", isInput: false, isOutput: false }
  ],
  nodes: [
    { id: "start", type: "start", label: "Start (Daily 9 AM)", config: { schedule: "0 9 * * *", objectName: "task" } },
    {
      id: "get_overdue_tasks",
      type: "get_record",
      label: "Get Severely Overdue Tasks",
      config: {
        objectName: "task",
        filter: { due_date: { $lt: "{3_days_ago}" }, is_completed: false, is_overdue: true },
        outputVariable: "overdueTasks",
        getAll: true
      }
    },
    {
      id: "loop_overdue",
      type: "loop",
      label: "Loop Through Overdue Tasks",
      config: { collection: "{overdueTasks}", iteratorVariable: "currentTask" }
    },
    {
      id: "update_priority",
      type: "update_record",
      label: "Escalate Priority",
      config: {
        objectName: "task",
        filter: { id: "{currentTask.id}" },
        fields: { priority: "urgent", tags: ["important", "follow_up"] }
      }
    },
    {
      id: "notify_owner",
      type: "script",
      label: "Notify Task Owner",
      config: {
        actionType: "email",
        inputs: {
          to: "{currentTask.owner.email}",
          subject: "URGENT: Task Overdue - {currentTask.subject}",
          template: "overdue_escalation_email",
          data: { taskSubject: "{currentTask.subject}", dueDate: "{currentTask.due_date}", daysOverdue: "{currentTask.days_overdue}" }
        }
      }
    },
    { id: "end", type: "end", label: "End" }
  ],
  edges: [
    { id: "e1", source: "start", target: "get_overdue_tasks", type: "default" },
    { id: "e2", source: "get_overdue_tasks", target: "loop_overdue", type: "default" },
    { id: "e3", source: "loop_overdue", target: "update_priority", type: "default" },
    { id: "e4", source: "update_priority", target: "notify_owner", type: "default" },
    { id: "e5", source: "notify_owner", target: "end", type: "default" }
  ]
};
var TaskCompletionFlow = {
  name: "task_completion",
  label: "Task Completion Process",
  description: "Flow triggered when a task is marked as complete",
  type: "record_change",
  variables: [
    { name: "taskId", type: "text", isInput: true, isOutput: false },
    { name: "completedTask", type: "record", isInput: false, isOutput: false }
  ],
  nodes: [
    { id: "start", type: "start", label: "Start", config: { objectName: "task", triggerCondition: 'ISCHANGED(status) AND status = "completed"' } },
    {
      id: "get_task",
      type: "get_record",
      label: "Get Completed Task",
      config: { objectName: "task", filter: { id: "{taskId}" }, outputVariable: "completedTask" }
    },
    {
      id: "check_recurring",
      type: "decision",
      label: "Is Recurring Task?",
      config: { condition: "{completedTask.is_recurring} == true" }
    },
    {
      id: "create_next_task",
      type: "create_record",
      label: "Create Next Recurring Task",
      config: {
        objectName: "task",
        fields: {
          subject: "{completedTask.subject}",
          description: "{completedTask.description}",
          priority: "{completedTask.priority}",
          category: "{completedTask.category}",
          owner: "{completedTask.owner}",
          is_recurring: true,
          recurrence_type: "{completedTask.recurrence_type}",
          recurrence_interval: "{completedTask.recurrence_interval}",
          due_date: 'DATEADD({completedTask.due_date}, {completedTask.recurrence_interval}, "{completedTask.recurrence_type}")',
          status: "not_started",
          is_completed: false
        },
        outputVariable: "newTaskId"
      }
    },
    { id: "end", type: "end", label: "End" }
  ],
  edges: [
    { id: "e1", source: "start", target: "get_task", type: "default" },
    { id: "e2", source: "get_task", target: "check_recurring", type: "default" },
    { id: "e3", source: "check_recurring", target: "create_next_task", type: "default", condition: "{completedTask.is_recurring} == true", label: "Yes" },
    { id: "e4", source: "check_recurring", target: "end", type: "default", condition: "{completedTask.is_recurring} != true", label: "No" },
    { id: "e5", source: "create_next_task", target: "end", type: "default" }
  ]
};
var QuickAddTaskFlow = {
  name: "quick_add_task",
  label: "Quick Add Task",
  description: "Screen flow for quickly creating a new task",
  type: "screen",
  variables: [
    { name: "subject", type: "text", isInput: true, isOutput: false },
    { name: "priority", type: "text", isInput: true, isOutput: false },
    { name: "dueDate", type: "date", isInput: true, isOutput: false },
    { name: "newTaskId", type: "text", isInput: false, isOutput: true }
  ],
  nodes: [
    { id: "start", type: "start", label: "Start" },
    {
      id: "screen_1",
      type: "screen",
      label: "Task Details",
      config: {
        fields: [
          { name: "subject", label: "Task Subject", type: "text", required: true },
          { name: "priority", label: "Priority", type: "select", options: ["low", "normal", "high", "urgent"], defaultValue: "normal" },
          { name: "dueDate", label: "Due Date", type: "date", required: false },
          { name: "category", label: "Category", type: "select", options: ["Personal", "Work", "Shopping", "Health", "Finance", "Other"] }
        ]
      }
    },
    {
      id: "create_task",
      type: "create_record",
      label: "Create Task",
      config: {
        objectName: "task",
        fields: { subject: "{subject}", priority: "{priority}", due_date: "{dueDate}", category: "{category}", status: "not_started", owner: "{$User.Id}" },
        outputVariable: "newTaskId"
      }
    },
    {
      id: "success_screen",
      type: "screen",
      label: "Success",
      config: {
        message: 'Task "{subject}" created successfully!',
        buttons: [
          { label: "Create Another", action: "restart" },
          { label: "View Task", action: "navigate", target: "/task/{newTaskId}" },
          { label: "Done", action: "finish" }
        ]
      }
    },
    { id: "end", type: "end", label: "End" }
  ],
  edges: [
    { id: "e1", source: "start", target: "screen_1", type: "default" },
    { id: "e2", source: "screen_1", target: "create_task", type: "default" },
    { id: "e3", source: "create_task", target: "success_screen", type: "default" },
    { id: "e4", source: "success_screen", target: "end", type: "default" }
  ]
};

// ../app-todo/src/apps/index.ts
var apps_exports2 = {};
__export(apps_exports2, {
  TodoApp: () => TodoApp
});

// ../app-todo/src/apps/todo.app.ts
import { App as App2 } from "@objectstack/spec/ui";
var TodoApp = App2.create({
  name: "todo_app",
  label: "Todo Manager",
  icon: "check-square",
  branding: {
    primaryColor: "#10B981",
    secondaryColor: "#3B82F6",
    logo: "/assets/todo-logo.png",
    favicon: "/assets/todo-favicon.ico"
  },
  navigation: [
    {
      id: "group_tasks",
      type: "group",
      label: "Tasks",
      icon: "check-square",
      children: [
        { id: "nav_all_tasks", type: "object", objectName: "task", label: "All Tasks", icon: "list" },
        { id: "nav_my_tasks", type: "object", objectName: "task", label: "My Tasks", icon: "user-check" },
        { id: "nav_overdue", type: "object", objectName: "task", label: "Overdue", icon: "alert-circle" },
        { id: "nav_today", type: "object", objectName: "task", label: "Due Today", icon: "calendar" },
        { id: "nav_upcoming", type: "object", objectName: "task", label: "Upcoming", icon: "calendar-plus" }
      ]
    },
    {
      id: "group_analytics",
      type: "group",
      label: "Analytics",
      icon: "chart-bar",
      children: [
        { id: "nav_dashboard", type: "dashboard", dashboardName: "task_dashboard", label: "Dashboard", icon: "layout-dashboard" }
      ]
    }
  ]
});

// ../app-todo/src/translations/index.ts
var translations_exports2 = {};
__export(translations_exports2, {
  TodoTranslations: () => TodoTranslations
});

// ../app-todo/src/translations/en.ts
var en2 = {
  objects: {
    task: {
      label: "Task",
      pluralLabel: "Tasks",
      fields: {
        subject: { label: "Subject", help: "Brief title of the task" },
        description: { label: "Description" },
        status: {
          label: "Status",
          options: {
            not_started: "Not Started",
            in_progress: "In Progress",
            waiting: "Waiting",
            completed: "Completed",
            deferred: "Deferred"
          }
        },
        priority: {
          label: "Priority",
          options: {
            low: "Low",
            normal: "Normal",
            high: "High",
            urgent: "Urgent"
          }
        },
        category: {
          label: "Category",
          options: {
            personal: "Personal",
            work: "Work",
            shopping: "Shopping",
            health: "Health",
            finance: "Finance",
            other: "Other"
          }
        },
        due_date: { label: "Due Date" },
        reminder_date: { label: "Reminder Date/Time" },
        completed_date: { label: "Completed Date" },
        owner: { label: "Assigned To" },
        tags: {
          label: "Tags",
          options: {
            important: "Important",
            quick_win: "Quick Win",
            blocked: "Blocked",
            follow_up: "Follow Up",
            review: "Review"
          }
        },
        is_recurring: { label: "Recurring Task" },
        recurrence_type: {
          label: "Recurrence Type",
          options: {
            daily: "Daily",
            weekly: "Weekly",
            monthly: "Monthly",
            yearly: "Yearly"
          }
        },
        recurrence_interval: { label: "Recurrence Interval" },
        is_completed: { label: "Is Completed" },
        is_overdue: { label: "Is Overdue" },
        progress_percent: { label: "Progress (%)" },
        estimated_hours: { label: "Estimated Hours" },
        actual_hours: { label: "Actual Hours" },
        notes: { label: "Notes" },
        category_color: { label: "Category Color" }
      }
    }
  },
  apps: {
    todo_app: {
      label: "Todo Manager",
      description: "Personal task management application"
    }
  },
  messages: {
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.create": "Create",
    "common.search": "Search",
    "common.filter": "Filter",
    "common.sort": "Sort",
    "common.refresh": "Refresh",
    "common.export": "Export",
    "common.back": "Back",
    "common.confirm": "Confirm",
    "success.saved": "Successfully saved",
    "success.deleted": "Successfully deleted",
    "success.completed": "Task marked as completed",
    "confirm.delete": "Are you sure you want to delete this task?",
    "confirm.complete": "Mark this task as completed?",
    "error.required": "This field is required",
    "error.load_failed": "Failed to load data"
  },
  validationMessages: {
    completed_date_required: "Completed date is required when status is Completed",
    recurrence_fields_required: "Recurrence type is required for recurring tasks"
  }
};

// ../app-todo/src/translations/zh-CN.ts
var zhCN2 = {
  objects: {
    task: {
      label: "\u4EFB\u52A1",
      pluralLabel: "\u4EFB\u52A1",
      fields: {
        subject: { label: "\u4E3B\u9898", help: "\u4EFB\u52A1\u7684\u7B80\u8981\u6807\u9898" },
        description: { label: "\u63CF\u8FF0" },
        status: {
          label: "\u72B6\u6001",
          options: {
            not_started: "\u672A\u5F00\u59CB",
            in_progress: "\u8FDB\u884C\u4E2D",
            waiting: "\u7B49\u5F85\u4E2D",
            completed: "\u5DF2\u5B8C\u6210",
            deferred: "\u5DF2\u63A8\u8FDF"
          }
        },
        priority: {
          label: "\u4F18\u5148\u7EA7",
          options: {
            low: "\u4F4E",
            normal: "\u666E\u901A",
            high: "\u9AD8",
            urgent: "\u7D27\u6025"
          }
        },
        category: {
          label: "\u5206\u7C7B",
          options: {
            personal: "\u4E2A\u4EBA",
            work: "\u5DE5\u4F5C",
            shopping: "\u8D2D\u7269",
            health: "\u5065\u5EB7",
            finance: "\u8D22\u52A1",
            other: "\u5176\u4ED6"
          }
        },
        due_date: { label: "\u622A\u6B62\u65E5\u671F" },
        reminder_date: { label: "\u63D0\u9192\u65E5\u671F/\u65F6\u95F4" },
        completed_date: { label: "\u5B8C\u6210\u65E5\u671F" },
        owner: { label: "\u8D1F\u8D23\u4EBA" },
        tags: {
          label: "\u6807\u7B7E",
          options: {
            important: "\u91CD\u8981",
            quick_win: "\u901F\u80DC",
            blocked: "\u53D7\u963B",
            follow_up: "\u5F85\u8DDF\u8FDB",
            review: "\u5F85\u5BA1\u6838"
          }
        },
        is_recurring: { label: "\u5468\u671F\u6027\u4EFB\u52A1" },
        recurrence_type: {
          label: "\u91CD\u590D\u7C7B\u578B",
          options: {
            daily: "\u6BCF\u5929",
            weekly: "\u6BCF\u5468",
            monthly: "\u6BCF\u6708",
            yearly: "\u6BCF\u5E74"
          }
        },
        recurrence_interval: { label: "\u91CD\u590D\u95F4\u9694" },
        is_completed: { label: "\u662F\u5426\u5B8C\u6210" },
        is_overdue: { label: "\u662F\u5426\u903E\u671F" },
        progress_percent: { label: "\u8FDB\u5EA6 (%)" },
        estimated_hours: { label: "\u9884\u4F30\u5DE5\u65F6" },
        actual_hours: { label: "\u5B9E\u9645\u5DE5\u65F6" },
        notes: { label: "\u5907\u6CE8" },
        category_color: { label: "\u5206\u7C7B\u989C\u8272" }
      }
    }
  },
  apps: {
    todo_app: {
      label: "\u5F85\u529E\u7BA1\u7406",
      description: "\u4E2A\u4EBA\u4EFB\u52A1\u7BA1\u7406\u5E94\u7528"
    }
  },
  messages: {
    "common.save": "\u4FDD\u5B58",
    "common.cancel": "\u53D6\u6D88",
    "common.delete": "\u5220\u9664",
    "common.edit": "\u7F16\u8F91",
    "common.create": "\u65B0\u5EFA",
    "common.search": "\u641C\u7D22",
    "common.filter": "\u7B5B\u9009",
    "common.sort": "\u6392\u5E8F",
    "common.refresh": "\u5237\u65B0",
    "common.export": "\u5BFC\u51FA",
    "common.back": "\u8FD4\u56DE",
    "common.confirm": "\u786E\u8BA4",
    "success.saved": "\u4FDD\u5B58\u6210\u529F",
    "success.deleted": "\u5220\u9664\u6210\u529F",
    "success.completed": "\u4EFB\u52A1\u5DF2\u6807\u8BB0\u4E3A\u5B8C\u6210",
    "confirm.delete": "\u786E\u5B9A\u8981\u5220\u9664\u6B64\u4EFB\u52A1\u5417\uFF1F",
    "confirm.complete": "\u786E\u5B9A\u5C06\u6B64\u4EFB\u52A1\u6807\u8BB0\u4E3A\u5B8C\u6210\uFF1F",
    "error.required": "\u6B64\u5B57\u6BB5\u4E3A\u5FC5\u586B\u9879",
    "error.load_failed": "\u6570\u636E\u52A0\u8F7D\u5931\u8D25"
  },
  validationMessages: {
    completed_date_required: '\u72B6\u6001\u4E3A"\u5DF2\u5B8C\u6210"\u65F6\uFF0C\u5B8C\u6210\u65E5\u671F\u4E3A\u5FC5\u586B\u9879',
    recurrence_fields_required: "\u5468\u671F\u6027\u4EFB\u52A1\u5FC5\u987B\u6307\u5B9A\u91CD\u590D\u7C7B\u578B"
  }
};

// ../app-todo/src/translations/ja-JP.ts
var jaJP2 = {
  objects: {
    task: {
      label: "\u30BF\u30B9\u30AF",
      pluralLabel: "\u30BF\u30B9\u30AF",
      fields: {
        subject: { label: "\u4EF6\u540D", help: "\u30BF\u30B9\u30AF\u306E\u7C21\u5358\u306A\u30BF\u30A4\u30C8\u30EB" },
        description: { label: "\u8AAC\u660E" },
        status: {
          label: "\u30B9\u30C6\u30FC\u30BF\u30B9",
          options: {
            not_started: "\u672A\u7740\u624B",
            in_progress: "\u9032\u884C\u4E2D",
            waiting: "\u5F85\u6A5F\u4E2D",
            completed: "\u5B8C\u4E86",
            deferred: "\u5EF6\u671F"
          }
        },
        priority: {
          label: "\u512A\u5148\u5EA6",
          options: {
            low: "\u4F4E",
            normal: "\u901A\u5E38",
            high: "\u9AD8",
            urgent: "\u7DCA\u6025"
          }
        },
        category: {
          label: "\u30AB\u30C6\u30B4\u30EA",
          options: {
            personal: "\u500B\u4EBA",
            work: "\u4ED5\u4E8B",
            shopping: "\u8CB7\u3044\u7269",
            health: "\u5065\u5EB7",
            finance: "\u8CA1\u52D9",
            other: "\u305D\u306E\u4ED6"
          }
        },
        due_date: { label: "\u671F\u65E5" },
        reminder_date: { label: "\u30EA\u30DE\u30A4\u30F3\u30C0\u30FC\u65E5\u6642" },
        completed_date: { label: "\u5B8C\u4E86\u65E5" },
        owner: { label: "\u62C5\u5F53\u8005" },
        tags: {
          label: "\u30BF\u30B0",
          options: {
            important: "\u91CD\u8981",
            quick_win: "\u30AF\u30A4\u30C3\u30AF\u30A6\u30A3\u30F3",
            blocked: "\u30D6\u30ED\u30C3\u30AF\u4E2D",
            follow_up: "\u30D5\u30A9\u30ED\u30FC\u30A2\u30C3\u30D7",
            review: "\u30EC\u30D3\u30E5\u30FC"
          }
        },
        is_recurring: { label: "\u7E70\u308A\u8FD4\u3057\u30BF\u30B9\u30AF" },
        recurrence_type: {
          label: "\u7E70\u308A\u8FD4\u3057\u30BF\u30A4\u30D7",
          options: {
            daily: "\u6BCE\u65E5",
            weekly: "\u6BCE\u9031",
            monthly: "\u6BCE\u6708",
            yearly: "\u6BCE\u5E74"
          }
        },
        recurrence_interval: { label: "\u7E70\u308A\u8FD4\u3057\u9593\u9694" },
        is_completed: { label: "\u5B8C\u4E86\u6E08\u307F" },
        is_overdue: { label: "\u671F\u9650\u8D85\u904E" },
        progress_percent: { label: "\u9032\u6357\u7387 (%)" },
        estimated_hours: { label: "\u898B\u7A4D\u6642\u9593" },
        actual_hours: { label: "\u5B9F\u7E3E\u6642\u9593" },
        notes: { label: "\u30E1\u30E2" },
        category_color: { label: "\u30AB\u30C6\u30B4\u30EA\u8272" }
      }
    }
  },
  apps: {
    todo_app: {
      label: "ToDo \u30DE\u30CD\u30FC\u30B8\u30E3\u30FC",
      description: "\u500B\u4EBA\u30BF\u30B9\u30AF\u7BA1\u7406\u30A2\u30D7\u30EA\u30B1\u30FC\u30B7\u30E7\u30F3"
    }
  },
  messages: {
    "common.save": "\u4FDD\u5B58",
    "common.cancel": "\u30AD\u30E3\u30F3\u30BB\u30EB",
    "common.delete": "\u524A\u9664",
    "common.edit": "\u7DE8\u96C6",
    "common.create": "\u65B0\u898F\u4F5C\u6210",
    "common.search": "\u691C\u7D22",
    "common.filter": "\u30D5\u30A3\u30EB\u30BF\u30FC",
    "common.sort": "\u4E26\u3079\u66FF\u3048",
    "common.refresh": "\u66F4\u65B0",
    "common.export": "\u30A8\u30AF\u30B9\u30DD\u30FC\u30C8",
    "common.back": "\u623B\u308B",
    "common.confirm": "\u78BA\u8A8D",
    "success.saved": "\u4FDD\u5B58\u3057\u307E\u3057\u305F",
    "success.deleted": "\u524A\u9664\u3057\u307E\u3057\u305F",
    "success.completed": "\u30BF\u30B9\u30AF\u3092\u5B8C\u4E86\u306B\u3057\u307E\u3057\u305F",
    "confirm.delete": "\u3053\u306E\u30BF\u30B9\u30AF\u3092\u524A\u9664\u3057\u3066\u3082\u3088\u308D\u3057\u3044\u3067\u3059\u304B\uFF1F",
    "confirm.complete": "\u3053\u306E\u30BF\u30B9\u30AF\u3092\u5B8C\u4E86\u306B\u3057\u307E\u3059\u304B\uFF1F",
    "error.required": "\u3053\u306E\u9805\u76EE\u306F\u5FC5\u9808\u3067\u3059",
    "error.load_failed": "\u30C7\u30FC\u30BF\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F"
  },
  validationMessages: {
    completed_date_required: "\u30B9\u30C6\u30FC\u30BF\u30B9\u304C\u300C\u5B8C\u4E86\u300D\u306E\u5834\u5408\u3001\u5B8C\u4E86\u65E5\u306F\u5FC5\u9808\u3067\u3059",
    recurrence_fields_required: "\u7E70\u308A\u8FD4\u3057\u30BF\u30B9\u30AF\u306B\u306F\u7E70\u308A\u8FD4\u3057\u30BF\u30A4\u30D7\u304C\u5FC5\u8981\u3067\u3059"
  }
};

// ../app-todo/src/translations/todo.translation.ts
var TodoTranslations = {
  en: en2,
  "zh-CN": zhCN2,
  "ja-JP": jaJP2
};

// ../app-todo/objectstack.config.ts
var objectstack_config_default2 = defineStack2({
  manifest: {
    id: "com.example.todo",
    namespace: "todo",
    version: "2.0.0",
    type: "app",
    name: "Todo Manager",
    description: "A comprehensive Todo app demonstrating ObjectStack Protocol features including automation, dashboards, and reports"
  },
  // Seed Data (top-level, registered as metadata)
  data: [
    {
      object: "task",
      mode: "upsert",
      externalId: "subject",
      records: [
        { subject: "Learn ObjectStack", status: "completed", priority: "high", category: "Work" },
        { subject: "Build a cool app", status: "in_progress", priority: "normal", category: "Work", due_date: new Date(Date.now() + 864e5 * 3) },
        { subject: "Review PR #102", status: "completed", priority: "high", category: "Work" },
        { subject: "Write Documentation", status: "not_started", priority: "normal", category: "Work", due_date: new Date(Date.now() + 864e5) },
        { subject: "Fix Server bug", status: "waiting", priority: "urgent", category: "Work" },
        { subject: "Buy groceries", status: "not_started", priority: "low", category: "Shopping", due_date: /* @__PURE__ */ new Date() },
        { subject: "Schedule dentist appointment", status: "not_started", priority: "normal", category: "Health", due_date: new Date(Date.now() + 864e5 * 7) },
        { subject: "Pay utility bills", status: "not_started", priority: "high", category: "Finance", due_date: new Date(Date.now() + 864e5 * 2) }
      ]
    }
  ],
  // Auto-collected from barrel index files via Object.values()
  objects: Object.values(objects_exports2),
  actions: Object.values(actions_exports2),
  dashboards: Object.values(dashboards_exports2),
  reports: Object.values(reports_exports2),
  flows: Object.values(flows_exports2),
  apps: Object.values(apps_exports2),
  // I18n Configuration — per-locale file organization
  i18n: {
    defaultLocale: "en",
    supportedLocales: ["en", "zh-CN", "ja-JP"],
    fallbackLocale: "en",
    fileOrganization: "per_locale"
  },
  // I18n Translation Bundles (en, zh-CN, ja-JP)
  translations: Object.values(translations_exports2)
});

// ../plugin-bi/objectstack.config.ts
import { defineStack as defineStack3 } from "@objectstack/spec";
var objectstack_config_default3 = defineStack3({
  manifest: {
    id: "com.example.bi",
    namespace: "bi",
    version: "1.0.0",
    type: "plugin",
    name: "BI Plugin",
    description: "Business Intelligence dashboards and analytics"
  },
  // Placeholder - no objects or dashboards yet
  objects: [],
  dashboards: []
});

// objectstack.config.ts
var authPlugin = new AuthPlugin({
  secret: process.env.AUTH_SECRET ?? "dev-secret-please-change-in-production-min-32-chars",
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
});
var objectstack_config_default4 = defineStack4({
  manifest: {
    id: "app-host",
    name: "app_host",
    version: "1.0.0",
    description: "Host application aggregating CRM, Todo and BI plugins",
    type: "app"
  },
  // Explicitly Load Plugins and Apps
  // The Runtime CLI will iterate this list and call kernel.use()
  plugins: [
    new ObjectQLPlugin(),
    // Register Default Driver (Memory)
    new DriverPlugin(new InMemoryDriver()),
    // Authentication — required for production (Vercel) deployments
    authPlugin,
    // Wrap Manifests/Stacks in AppPlugin adapter
    new AppPlugin(objectstack_config_default),
    new AppPlugin(objectstack_config_default2),
    new AppPlugin(objectstack_config_default3)
  ]
});
var PreviewHostExample = defineStack4({
  manifest: {
    id: "app-host-preview",
    name: "app_host_preview",
    version: "1.0.0",
    description: "Host application in preview/demo mode \u2014 bypasses login, simulates admin user",
    type: "app"
  },
  // Same plugins as the standard host
  plugins: [
    new ObjectQLPlugin(),
    new DriverPlugin(new InMemoryDriver()),
    authPlugin,
    new AppPlugin(objectstack_config_default),
    new AppPlugin(objectstack_config_default2),
    new AppPlugin(objectstack_config_default3)
  ]
});
export {
  PreviewHostExample,
  objectstack_config_default4 as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vYXBwLWNybS9zcmMvaW50ZXJmYWNlcy9pbmRleC50cyIsICJvYmplY3RzdGFjay5jb25maWcudHMiLCAiLi4vYXBwLWNybS9vYmplY3RzdGFjay5jb25maWcudHMiLCAiLi4vYXBwLWNybS9zcmMvb2JqZWN0cy9pbmRleC50cyIsICIuLi9hcHAtY3JtL3NyYy9vYmplY3RzL2FjY291bnQub2JqZWN0LnRzIiwgIi4uL2FwcC1jcm0vc3JjL29iamVjdHMvY2FtcGFpZ24ub2JqZWN0LnRzIiwgIi4uL2FwcC1jcm0vc3JjL29iamVjdHMvY2FzZS5vYmplY3QudHMiLCAiLi4vYXBwLWNybS9zcmMvb2JqZWN0cy9jb250YWN0Lm9iamVjdC50cyIsICIuLi9hcHAtY3JtL3NyYy9vYmplY3RzL2NvbnRyYWN0Lm9iamVjdC50cyIsICIuLi9hcHAtY3JtL3NyYy9vYmplY3RzL2xlYWQub2JqZWN0LnRzIiwgIi4uL2FwcC1jcm0vc3JjL29iamVjdHMvbGVhZC5zdGF0ZS50cyIsICIuLi9hcHAtY3JtL3NyYy9vYmplY3RzL29wcG9ydHVuaXR5Lm9iamVjdC50cyIsICIuLi9hcHAtY3JtL3NyYy9vYmplY3RzL3Byb2R1Y3Qub2JqZWN0LnRzIiwgIi4uL2FwcC1jcm0vc3JjL29iamVjdHMvcXVvdGUub2JqZWN0LnRzIiwgIi4uL2FwcC1jcm0vc3JjL29iamVjdHMvdGFzay5vYmplY3QudHMiLCAiLi4vYXBwLWNybS9zcmMvYXBpcy9pbmRleC50cyIsICIuLi9hcHAtY3JtL3NyYy9hcGlzL2xlYWQtY29udmVydC5hcGkudHMiLCAiLi4vYXBwLWNybS9zcmMvYXBpcy9waXBlbGluZS1zdGF0cy5hcGkudHMiLCAiLi4vYXBwLWNybS9zcmMvYWN0aW9ucy9pbmRleC50cyIsICIuLi9hcHAtY3JtL3NyYy9hY3Rpb25zL2Nhc2UuYWN0aW9ucy50cyIsICIuLi9hcHAtY3JtL3NyYy9hY3Rpb25zL2NvbnRhY3QuYWN0aW9ucy50cyIsICIuLi9hcHAtY3JtL3NyYy9hY3Rpb25zL2dsb2JhbC5hY3Rpb25zLnRzIiwgIi4uL2FwcC1jcm0vc3JjL2FjdGlvbnMvbGVhZC5hY3Rpb25zLnRzIiwgIi4uL2FwcC1jcm0vc3JjL2FjdGlvbnMvb3Bwb3J0dW5pdHkuYWN0aW9ucy50cyIsICIuLi9hcHAtY3JtL3NyYy9kYXNoYm9hcmRzL2luZGV4LnRzIiwgIi4uL2FwcC1jcm0vc3JjL2Rhc2hib2FyZHMvZXhlY3V0aXZlLmRhc2hib2FyZC50cyIsICIuLi9hcHAtY3JtL3NyYy9kYXNoYm9hcmRzL3NhbGVzLmRhc2hib2FyZC50cyIsICIuLi9hcHAtY3JtL3NyYy9kYXNoYm9hcmRzL3NlcnZpY2UuZGFzaGJvYXJkLnRzIiwgIi4uL2FwcC1jcm0vc3JjL3JlcG9ydHMvaW5kZXgudHMiLCAiLi4vYXBwLWNybS9zcmMvcmVwb3J0cy9hY2NvdW50LnJlcG9ydC50cyIsICIuLi9hcHAtY3JtL3NyYy9yZXBvcnRzL2Nhc2UucmVwb3J0LnRzIiwgIi4uL2FwcC1jcm0vc3JjL3JlcG9ydHMvY29udGFjdC5yZXBvcnQudHMiLCAiLi4vYXBwLWNybS9zcmMvcmVwb3J0cy9sZWFkLnJlcG9ydC50cyIsICIuLi9hcHAtY3JtL3NyYy9yZXBvcnRzL29wcG9ydHVuaXR5LnJlcG9ydC50cyIsICIuLi9hcHAtY3JtL3NyYy9yZXBvcnRzL3Rhc2sucmVwb3J0LnRzIiwgIi4uL2FwcC1jcm0vc3JjL2Zsb3dzL2luZGV4LnRzIiwgIi4uL2FwcC1jcm0vc3JjL2Zsb3dzL2NhbXBhaWduLWVucm9sbG1lbnQuZmxvdy50cyIsICIuLi9hcHAtY3JtL3NyYy9mbG93cy9jYXNlLWVzY2FsYXRpb24uZmxvdy50cyIsICIuLi9hcHAtY3JtL3NyYy9mbG93cy9sZWFkLWNvbnZlcnNpb24uZmxvdy50cyIsICIuLi9hcHAtY3JtL3NyYy9mbG93cy9vcHBvcnR1bml0eS1hcHByb3ZhbC5mbG93LnRzIiwgIi4uL2FwcC1jcm0vc3JjL2Zsb3dzL3F1b3RlLWdlbmVyYXRpb24uZmxvdy50cyIsICIuLi9hcHAtY3JtL3NyYy9hZ2VudHMvaW5kZXgudHMiLCAiLi4vYXBwLWNybS9zcmMvYWdlbnRzL2VtYWlsLWNhbXBhaWduLmFnZW50LnRzIiwgIi4uL2FwcC1jcm0vc3JjL2FnZW50cy9sZWFkLWVucmljaG1lbnQuYWdlbnQudHMiLCAiLi4vYXBwLWNybS9zcmMvYWdlbnRzL3JldmVudWUtaW50ZWxsaWdlbmNlLmFnZW50LnRzIiwgIi4uL2FwcC1jcm0vc3JjL2FnZW50cy9zYWxlcy5hZ2VudC50cyIsICIuLi9hcHAtY3JtL3NyYy9hZ2VudHMvc2VydmljZS5hZ2VudC50cyIsICIuLi9hcHAtY3JtL3NyYy9yYWcvaW5kZXgudHMiLCAiLi4vYXBwLWNybS9zcmMvcmFnL2NvbXBldGl0aXZlLWludGVsLnJhZy50cyIsICIuLi9hcHAtY3JtL3NyYy9yYWcvcHJvZHVjdC1pbmZvLnJhZy50cyIsICIuLi9hcHAtY3JtL3NyYy9yYWcvc2FsZXMta25vd2xlZGdlLnJhZy50cyIsICIuLi9hcHAtY3JtL3NyYy9yYWcvc3VwcG9ydC1rbm93bGVkZ2UucmFnLnRzIiwgIi4uL2FwcC1jcm0vc3JjL3Byb2ZpbGVzL2luZGV4LnRzIiwgIi4uL2FwcC1jcm0vc3JjL3Byb2ZpbGVzL21hcmtldGluZy11c2VyLnByb2ZpbGUudHMiLCAiLi4vYXBwLWNybS9zcmMvcHJvZmlsZXMvc2FsZXMtbWFuYWdlci5wcm9maWxlLnRzIiwgIi4uL2FwcC1jcm0vc3JjL3Byb2ZpbGVzL3NhbGVzLXJlcC5wcm9maWxlLnRzIiwgIi4uL2FwcC1jcm0vc3JjL3Byb2ZpbGVzL3NlcnZpY2UtYWdlbnQucHJvZmlsZS50cyIsICIuLi9hcHAtY3JtL3NyYy9wcm9maWxlcy9zeXN0ZW0tYWRtaW4ucHJvZmlsZS50cyIsICIuLi9hcHAtY3JtL3NyYy9hcHBzL2luZGV4LnRzIiwgIi4uL2FwcC1jcm0vc3JjL2FwcHMvY3JtLmFwcC50cyIsICIuLi9hcHAtY3JtL3NyYy9hcHBzL2NybV9tb2Rlcm4uYXBwLnRzIiwgIi4uL2FwcC1jcm0vc3JjL3RyYW5zbGF0aW9ucy9pbmRleC50cyIsICIuLi9hcHAtY3JtL3NyYy90cmFuc2xhdGlvbnMvZW4udHMiLCAiLi4vYXBwLWNybS9zcmMvdHJhbnNsYXRpb25zL3poLUNOLnRzIiwgIi4uL2FwcC1jcm0vc3JjL3RyYW5zbGF0aW9ucy9qYS1KUC50cyIsICIuLi9hcHAtY3JtL3NyYy90cmFuc2xhdGlvbnMvZXMtRVMudHMiLCAiLi4vYXBwLWNybS9zcmMvdHJhbnNsYXRpb25zL2NybS50cmFuc2xhdGlvbi50cyIsICIuLi9hcHAtY3JtL3NyYy9kYXRhL2luZGV4LnRzIiwgIi4uL2FwcC1jcm0vc3JjL3NoYXJpbmcvYWNjb3VudC5zaGFyaW5nLnRzIiwgIi4uL2FwcC1jcm0vc3JjL3NoYXJpbmcvY2FzZS5zaGFyaW5nLnRzIiwgIi4uL2FwcC1jcm0vc3JjL3NoYXJpbmcvZGVmYXVsdHMuc2hhcmluZy50cyIsICIuLi9hcHAtY3JtL3NyYy9zaGFyaW5nL29wcG9ydHVuaXR5LnNoYXJpbmcudHMiLCAiLi4vYXBwLWNybS9zcmMvc2hhcmluZy9yb2xlLWhpZXJhcmNoeS50cyIsICIuLi9hcHAtdG9kby9vYmplY3RzdGFjay5jb25maWcudHMiLCAiLi4vYXBwLXRvZG8vc3JjL29iamVjdHMvaW5kZXgudHMiLCAiLi4vYXBwLXRvZG8vc3JjL29iamVjdHMvdGFzay5vYmplY3QudHMiLCAiLi4vYXBwLXRvZG8vc3JjL2FjdGlvbnMvaW5kZXgudHMiLCAiLi4vYXBwLXRvZG8vc3JjL2FjdGlvbnMvdGFzay5hY3Rpb25zLnRzIiwgIi4uL2FwcC10b2RvL3NyYy9kYXNoYm9hcmRzL2luZGV4LnRzIiwgIi4uL2FwcC10b2RvL3NyYy9kYXNoYm9hcmRzL3Rhc2suZGFzaGJvYXJkLnRzIiwgIi4uL2FwcC10b2RvL3NyYy9yZXBvcnRzL2luZGV4LnRzIiwgIi4uL2FwcC10b2RvL3NyYy9yZXBvcnRzL3Rhc2sucmVwb3J0LnRzIiwgIi4uL2FwcC10b2RvL3NyYy9mbG93cy9pbmRleC50cyIsICIuLi9hcHAtdG9kby9zcmMvZmxvd3MvdGFzay5mbG93LnRzIiwgIi4uL2FwcC10b2RvL3NyYy9hcHBzL2luZGV4LnRzIiwgIi4uL2FwcC10b2RvL3NyYy9hcHBzL3RvZG8uYXBwLnRzIiwgIi4uL2FwcC10b2RvL3NyYy90cmFuc2xhdGlvbnMvaW5kZXgudHMiLCAiLi4vYXBwLXRvZG8vc3JjL3RyYW5zbGF0aW9ucy9lbi50cyIsICIuLi9hcHAtdG9kby9zcmMvdHJhbnNsYXRpb25zL3poLUNOLnRzIiwgIi4uL2FwcC10b2RvL3NyYy90cmFuc2xhdGlvbnMvamEtSlAudHMiLCAiLi4vYXBwLXRvZG8vc3JjL3RyYW5zbGF0aW9ucy90b2RvLnRyYW5zbGF0aW9uLnRzIiwgIi4uL3BsdWdpbi1iaS9vYmplY3RzdGFjay5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvaW50ZXJmYWNlcy9pbmRleC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9pbnRlcmZhY2VzXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2ludGVyZmFjZXMvaW5kZXgudHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1ob3N0L29iamVjdHN0YWNrLmNvbmZpZy50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtaG9zdFwiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtaG9zdC9vYmplY3RzdGFjay5jb25maWcudHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbmltcG9ydCB7IGRlZmluZVN0YWNrIH0gZnJvbSAnQG9iamVjdHN0YWNrL3NwZWMnO1xuaW1wb3J0IHsgQXBwUGx1Z2luLCBEcml2ZXJQbHVnaW4gfSBmcm9tICdAb2JqZWN0c3RhY2svcnVudGltZSc7XG5pbXBvcnQgeyBPYmplY3RRTFBsdWdpbiB9IGZyb20gJ0BvYmplY3RzdGFjay9vYmplY3RxbCc7XG5pbXBvcnQgeyBJbk1lbW9yeURyaXZlciB9IGZyb20gJ0BvYmplY3RzdGFjay9kcml2ZXItbWVtb3J5JztcbmltcG9ydCB7IEF1dGhQbHVnaW4gfSBmcm9tICdAb2JqZWN0c3RhY2svcGx1Z2luLWF1dGgnO1xuaW1wb3J0IENybUFwcCBmcm9tICcuLi9hcHAtY3JtL29iamVjdHN0YWNrLmNvbmZpZyc7XG5pbXBvcnQgVG9kb0FwcCBmcm9tICcuLi9hcHAtdG9kby9vYmplY3RzdGFjay5jb25maWcnO1xuaW1wb3J0IEJpUGx1Z2luTWFuaWZlc3QgZnJvbSAnLi4vcGx1Z2luLWJpL29iamVjdHN0YWNrLmNvbmZpZyc7XG5cbi8vIEFwcCBIb3N0IEV4YW1wbGVcbi8vIFRoaXMgcHJvamVjdCBhY3RzIGFzIGEgXCJQbGF0Zm9ybSBTZXJ2ZXJcIiB0aGF0IGxvYWRzIG11bHRpcGxlIGFwcHMgYW5kIHBsdWdpbnMuXG4vLyBJdCBlZmZlY3RpdmVseSByZXBsYWNlcyB0aGUgbWFudWFsIGNvbXBvc2l0aW9uIGluIGBzcmMvaW5kZXgudHNgLlxuXG4vLyBTaGFyZWQgYXV0aGVudGljYXRpb24gcGx1Z2luIFx1MjAxNCByZWFkcyBzZWNyZXRzIGZyb20gZW52aXJvbm1lbnQgdmFyaWFibGVzIHNvIHRoZVxuLy8gc2FtZSBjb25maWcgd29ya3MgYm90aCBsb2NhbGx5IGFuZCBvbiBWZXJjZWwgKHdoZXJlIFZFUkNFTF9VUkwgaXMgaW5qZWN0ZWQpLlxuY29uc3QgYXV0aFBsdWdpbiA9IG5ldyBBdXRoUGx1Z2luKHtcbiAgc2VjcmV0OiBwcm9jZXNzLmVudi5BVVRIX1NFQ1JFVCA/PyAnZGV2LXNlY3JldC1wbGVhc2UtY2hhbmdlLWluLXByb2R1Y3Rpb24tbWluLTMyLWNoYXJzJyxcbiAgYmFzZVVybDogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfQkFTRV9VUkwgPz8gKHByb2Nlc3MuZW52LlZFUkNFTF9VUkxcbiAgICA/IGBodHRwczovLyR7cHJvY2Vzcy5lbnYuVkVSQ0VMX1VSTH1gXG4gICAgOiAnaHR0cDovL2xvY2FsaG9zdDozMDAwJyksXG59KTtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lU3RhY2soe1xuICBtYW5pZmVzdDoge1xuICAgIGlkOiAnYXBwLWhvc3QnLFxuICAgIG5hbWU6ICdhcHBfaG9zdCcsXG4gICAgdmVyc2lvbjogJzEuMC4wJyxcbiAgICBkZXNjcmlwdGlvbjogJ0hvc3QgYXBwbGljYXRpb24gYWdncmVnYXRpbmcgQ1JNLCBUb2RvIGFuZCBCSSBwbHVnaW5zJyxcbiAgICB0eXBlOiAnYXBwJyxcbiAgfSxcbiAgXG4gIC8vIEV4cGxpY2l0bHkgTG9hZCBQbHVnaW5zIGFuZCBBcHBzXG4gIC8vIFRoZSBSdW50aW1lIENMSSB3aWxsIGl0ZXJhdGUgdGhpcyBsaXN0IGFuZCBjYWxsIGtlcm5lbC51c2UoKVxuICBwbHVnaW5zOiBbXG4gICAgbmV3IE9iamVjdFFMUGx1Z2luKCksXG4gICAgLy8gUmVnaXN0ZXIgRGVmYXVsdCBEcml2ZXIgKE1lbW9yeSlcbiAgICBuZXcgRHJpdmVyUGx1Z2luKG5ldyBJbk1lbW9yeURyaXZlcigpKSxcbiAgICAvLyBBdXRoZW50aWNhdGlvbiBcdTIwMTQgcmVxdWlyZWQgZm9yIHByb2R1Y3Rpb24gKFZlcmNlbCkgZGVwbG95bWVudHNcbiAgICBhdXRoUGx1Z2luLFxuICAgIC8vIFdyYXAgTWFuaWZlc3RzL1N0YWNrcyBpbiBBcHBQbHVnaW4gYWRhcHRlclxuICAgIG5ldyBBcHBQbHVnaW4oQ3JtQXBwKSxcbiAgICBuZXcgQXBwUGx1Z2luKFRvZG9BcHApLFxuICAgIG5ldyBBcHBQbHVnaW4oQmlQbHVnaW5NYW5pZmVzdClcbiAgXVxufSk7XG5cbi8qKlxuICogUHJldmlldyBNb2RlIEhvc3QgRXhhbXBsZVxuICpcbiAqIERlbW9uc3RyYXRlcyBob3cgdG8gcnVuIHRoZSBwbGF0Zm9ybSBpbiBcInByZXZpZXdcIiBtb2RlLlxuICogV2hlbiBgbW9kZWAgaXMgc2V0IHRvIGAncHJldmlldydgLCB0aGUga2VybmVsIHNpZ25hbHMgdGhlIGZyb250ZW5kIHRvOlxuICogLSBTa2lwIGxvZ2luL3JlZ2lzdHJhdGlvbiBzY3JlZW5zXG4gKiAtIEF1dG9tYXRpY2FsbHkgc2ltdWxhdGUgYW4gYWRtaW4gaWRlbnRpdHlcbiAqIC0gRGlzcGxheSBhIHByZXZpZXctbW9kZSBiYW5uZXIgdG8gdGhlIHVzZXJcbiAqXG4gKiBVc2UgdGhpcyBmb3IgbWFya2V0cGxhY2UgZGVtb3MsIGFwcCBzaG93Y2FzZXMsIG9yIG9uYm9hcmRpbmdcbiAqIHRvdXJzIHdoZXJlIHZpc2l0b3JzIHNob3VsZCBleHBsb3JlIHRoZSBzeXN0ZW0gd2l0aG91dCBzaWduaW5nIHVwLlxuICpcbiAqICMjIFVzYWdlXG4gKlxuICogU2V0IHRoZSBgT1NfTU9ERWAgZW52aXJvbm1lbnQgdmFyaWFibGUgdG8gYHByZXZpZXdgIGF0IGJvb3Q6XG4gKlxuICogYGBgYmFzaFxuICogT1NfTU9ERT1wcmV2aWV3IHBucG0gZGV2XG4gKiBgYGBcbiAqXG4gKiBPciB1c2UgdGhpcyBzdGFjayBkZWZpbml0aW9uIGRpcmVjdGx5IGFzIGEgc3RhcnRpbmcgcG9pbnQuXG4gKlxuICogIyMgS2VybmVsQ29udGV4dCAoY3JlYXRlZCBieSB0aGUgUnVudGltZSBhdCBib290KVxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBLZXJuZWxDb250ZXh0U2NoZW1hIH0gZnJvbSAnQG9iamVjdHN0YWNrL3NwZWMva2VybmVsJztcbiAqXG4gKiBjb25zdCBjdHggPSBLZXJuZWxDb250ZXh0U2NoZW1hLnBhcnNlKHtcbiAqICAgaW5zdGFuY2VJZDogJzU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCcsXG4gKiAgIG1vZGU6ICdwcmV2aWV3JyxcbiAqICAgdmVyc2lvbjogJzEuMC4wJyxcbiAqICAgY3dkOiBwcm9jZXNzLmN3ZCgpLFxuICogICBzdGFydFRpbWU6IERhdGUubm93KCksXG4gKiAgIHByZXZpZXdNb2RlOiB7XG4gKiAgICAgYXV0b0xvZ2luOiB0cnVlLFxuICogICAgIHNpbXVsYXRlZFJvbGU6ICdhZG1pbicsXG4gKiAgICAgc2ltdWxhdGVkVXNlck5hbWU6ICdEZW1vIEFkbWluJyxcbiAqICAgICByZWFkT25seTogZmFsc2UsXG4gKiAgICAgYmFubmVyTWVzc2FnZTogJ1lvdSBhcmUgZXhwbG9yaW5nIGEgZGVtbyBcdTIwMTQgZGF0YSB3aWxsIGJlIHJlc2V0IHBlcmlvZGljYWxseS4nLFxuICogICB9LFxuICogfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IFByZXZpZXdIb3N0RXhhbXBsZSA9IGRlZmluZVN0YWNrKHtcbiAgbWFuaWZlc3Q6IHtcbiAgICBpZDogJ2FwcC1ob3N0LXByZXZpZXcnLFxuICAgIG5hbWU6ICdhcHBfaG9zdF9wcmV2aWV3JyxcbiAgICB2ZXJzaW9uOiAnMS4wLjAnLFxuICAgIGRlc2NyaXB0aW9uOiAnSG9zdCBhcHBsaWNhdGlvbiBpbiBwcmV2aWV3L2RlbW8gbW9kZSBcdTIwMTQgYnlwYXNzZXMgbG9naW4sIHNpbXVsYXRlcyBhZG1pbiB1c2VyJyxcbiAgICB0eXBlOiAnYXBwJyxcbiAgfSxcblxuICAvLyBTYW1lIHBsdWdpbnMgYXMgdGhlIHN0YW5kYXJkIGhvc3RcbiAgcGx1Z2luczogW1xuICAgIG5ldyBPYmplY3RRTFBsdWdpbigpLFxuICAgIG5ldyBEcml2ZXJQbHVnaW4obmV3IEluTWVtb3J5RHJpdmVyKCkpLFxuICAgIGF1dGhQbHVnaW4sXG4gICAgbmV3IEFwcFBsdWdpbihDcm1BcHApLFxuICAgIG5ldyBBcHBQbHVnaW4oVG9kb0FwcCksXG4gICAgbmV3IEFwcFBsdWdpbihCaVBsdWdpbk1hbmlmZXN0KVxuICBdXG59KTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vb2JqZWN0c3RhY2suY29uZmlnLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm1cIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9vYmplY3RzdGFjay5jb25maWcudHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbmltcG9ydCB7IGRlZmluZVN0YWNrIH0gZnJvbSAnQG9iamVjdHN0YWNrL3NwZWMnO1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgQmFycmVsIEltcG9ydHMgKG9uZSBwZXIgbWV0YWRhdGEgdHlwZSkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5pbXBvcnQgKiBhcyBvYmplY3RzIGZyb20gJy4vc3JjL29iamVjdHMnO1xuaW1wb3J0ICogYXMgYXBpcyBmcm9tICcuL3NyYy9hcGlzJztcbmltcG9ydCAqIGFzIGFjdGlvbnMgZnJvbSAnLi9zcmMvYWN0aW9ucyc7XG5pbXBvcnQgKiBhcyBkYXNoYm9hcmRzIGZyb20gJy4vc3JjL2Rhc2hib2FyZHMnO1xuaW1wb3J0ICogYXMgcmVwb3J0cyBmcm9tICcuL3NyYy9yZXBvcnRzJztcbmltcG9ydCAqIGFzIGZsb3dzIGZyb20gJy4vc3JjL2Zsb3dzJztcbmltcG9ydCAqIGFzIGFnZW50cyBmcm9tICcuL3NyYy9hZ2VudHMnO1xuaW1wb3J0ICogYXMgcmFnUGlwZWxpbmVzIGZyb20gJy4vc3JjL3JhZyc7XG5pbXBvcnQgKiBhcyBwcm9maWxlcyBmcm9tICcuL3NyYy9wcm9maWxlcyc7XG5pbXBvcnQgKiBhcyBhcHBzIGZyb20gJy4vc3JjL2FwcHMnO1xuaW1wb3J0ICogYXMgaW50ZXJmYWNlcyBmcm9tICcuL3NyYy9pbnRlcmZhY2VzJztcbmltcG9ydCAqIGFzIHRyYW5zbGF0aW9ucyBmcm9tICcuL3NyYy90cmFuc2xhdGlvbnMnO1xuaW1wb3J0IHsgQ3JtU2VlZERhdGEgfSBmcm9tICcuL3NyYy9kYXRhJztcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFNoYXJpbmcgJiBTZWN1cml0eSAoc3BlY2lhbDogbWl4ZWQgc2luZ2xlL2FycmF5IHZhbHVlcykgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5pbXBvcnQge1xuICBPcmdhbml6YXRpb25EZWZhdWx0cyxcbiAgQWNjb3VudFRlYW1TaGFyaW5nUnVsZSwgVGVycml0b3J5U2hhcmluZ1J1bGVzLFxuICBPcHBvcnR1bml0eVNhbGVzU2hhcmluZ1J1bGUsXG4gIENhc2VFc2NhbGF0aW9uU2hhcmluZ1J1bGUsXG4gIFJvbGVIaWVyYXJjaHksXG59IGZyb20gJy4vc3JjL3NoYXJpbmcnO1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgQWN0aW9uIEhhbmRsZXIgUmVnaXN0cmF0aW9uIChydW50aW1lIGxpZmVjeWNsZSkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBIYW5kbGVycyBhcmUgd2lyZWQgc2VwYXJhdGVseSBmcm9tIG1ldGFkYXRhLiBUaGUgYG9uRW5hYmxlYCBleHBvcnRcbi8vIGlzIGNhbGxlZCBieSB0aGUga2VybmVsJ3MgQXBwUGx1Z2luIGFmdGVyIHRoZSBlbmdpbmUgaXMgcmVhZHkuXG4vLyBTZWU6IHNyYy9hY3Rpb25zL3JlZ2lzdGVyLWhhbmRsZXJzLnRzIGZvciB0aGUgZnVsbCByZWdpc3RyYXRpb24gZmxvdy5cbmltcG9ydCB7IHJlZ2lzdGVyQ3JtQWN0aW9uSGFuZGxlcnMgfSBmcm9tICcuL3NyYy9hY3Rpb25zL3JlZ2lzdGVyLWhhbmRsZXJzJztcblxuLyoqXG4gKiBQbHVnaW4gbGlmZWN5Y2xlIGhvb2sgXHUyMDE0IGNhbGxlZCBieSBBcHBQbHVnaW4gd2hlbiB0aGUgZW5naW5lIGlzIHJlYWR5LlxuICogVGhpcyBpcyB3aGVyZSBhY3Rpb24gaGFuZGxlcnMgYXJlIHJlZ2lzdGVyZWQgb24gdGhlIE9iamVjdFFMIGVuZ2luZS5cbiAqL1xuZXhwb3J0IGNvbnN0IG9uRW5hYmxlID0gYXN5bmMgKGN0eDogeyBxbDogeyByZWdpc3RlckFjdGlvbjogKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdm9pZCB9IH0pID0+IHtcbiAgcmVnaXN0ZXJDcm1BY3Rpb25IYW5kbGVycyhjdHgucWwpO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lU3RhY2soe1xuICBtYW5pZmVzdDoge1xuICAgIGlkOiAnY29tLmV4YW1wbGUuY3JtJyxcbiAgICBuYW1lc3BhY2U6ICdjcm0nLFxuICAgIHZlcnNpb246ICczLjAuMCcsXG4gICAgdHlwZTogJ2FwcCcsXG4gICAgbmFtZTogJ0VudGVycHJpc2UgQ1JNJyxcbiAgICBkZXNjcmlwdGlvbjogJ0NvbXByZWhlbnNpdmUgZW50ZXJwcmlzZSBDUk0gZGVtb25zdHJhdGluZyBhbGwgT2JqZWN0U3RhY2sgUHJvdG9jb2wgZmVhdHVyZXMgaW5jbHVkaW5nIEFJLCBzZWN1cml0eSwgYW5kIGF1dG9tYXRpb24nLFxuICB9LFxuXG4gIC8vIEF1dG8tY29sbGVjdGVkIGZyb20gYmFycmVsIGluZGV4IGZpbGVzIHZpYSBPYmplY3QudmFsdWVzKClcbiAgb2JqZWN0czogT2JqZWN0LnZhbHVlcyhvYmplY3RzKSxcbiAgYXBpczogT2JqZWN0LnZhbHVlcyhhcGlzKSxcbiAgYWN0aW9uczogT2JqZWN0LnZhbHVlcyhhY3Rpb25zKSxcbiAgZGFzaGJvYXJkczogT2JqZWN0LnZhbHVlcyhkYXNoYm9hcmRzKSxcbiAgcmVwb3J0czogT2JqZWN0LnZhbHVlcyhyZXBvcnRzKSxcbiAgZmxvd3M6IE9iamVjdC52YWx1ZXMoZmxvd3MpIGFzIGFueSxcbiAgYWdlbnRzOiBPYmplY3QudmFsdWVzKGFnZW50cykgYXMgYW55LFxuICByYWdQaXBlbGluZXM6IE9iamVjdC52YWx1ZXMocmFnUGlwZWxpbmVzKSxcbiAgcHJvZmlsZXM6IE9iamVjdC52YWx1ZXMocHJvZmlsZXMpLFxuICBhcHBzOiBPYmplY3QudmFsdWVzKGFwcHMpLFxuICBpbnRlcmZhY2VzOiBPYmplY3QudmFsdWVzKGludGVyZmFjZXMpLFxuXG4gIC8vIFNlZWQgRGF0YSAodG9wLWxldmVsLCByZWdpc3RlcmVkIGFzIG1ldGFkYXRhKVxuICBkYXRhOiBDcm1TZWVkRGF0YSxcblxuICAvLyBJMThuIENvbmZpZ3VyYXRpb24gXHUyMDE0IHBlci1sb2NhbGUgZmlsZSBvcmdhbml6YXRpb25cbiAgaTE4bjoge1xuICAgIGRlZmF1bHRMb2NhbGU6ICdlbicsXG4gICAgc3VwcG9ydGVkTG9jYWxlczogWydlbicsICd6aC1DTicsICdqYS1KUCcsICdlcy1FUyddLFxuICAgIGZhbGxiYWNrTG9jYWxlOiAnZW4nLFxuICAgIGZpbGVPcmdhbml6YXRpb246ICdwZXJfbG9jYWxlJyxcbiAgfSxcblxuICAvLyBJMThuIFRyYW5zbGF0aW9uIEJ1bmRsZXMgKGVuLCB6aC1DTiwgamEtSlAsIGVzLUVTKVxuICB0cmFuc2xhdGlvbnM6IE9iamVjdC52YWx1ZXModHJhbnNsYXRpb25zKSxcblxuICAvLyBTaGFyaW5nICYgc2VjdXJpdHkgKHJlcXVpcmVzIGV4cGxpY2l0IHdpcmluZylcbiAgc2hhcmluZ1J1bGVzOiBbXG4gICAgQWNjb3VudFRlYW1TaGFyaW5nUnVsZSxcbiAgICBPcHBvcnR1bml0eVNhbGVzU2hhcmluZ1J1bGUsXG4gICAgQ2FzZUVzY2FsYXRpb25TaGFyaW5nUnVsZSxcbiAgICAuLi5UZXJyaXRvcnlTaGFyaW5nUnVsZXMsXG4gIF0sXG4gIHJvbGVIaWVyYXJjaHk6IFJvbGVIaWVyYXJjaHksXG4gIG9yZ2FuaXphdGlvbkRlZmF1bHRzOiBPcmdhbml6YXRpb25EZWZhdWx0cyxcbn0gYXMgYW55KTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL29iamVjdHMvaW5kZXgudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvb2JqZWN0c1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9vYmplY3RzL2luZGV4LnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG4vKipcbiAqIE9iamVjdCBEZWZpbml0aW9ucyBCYXJyZWxcbiAqIFxuICogUmUtZXhwb3J0cyBhbGwgKi5vYmplY3QudHMgZGVmaW5pdGlvbnMgZm9yIGF1dG8tcmVnaXN0cmF0aW9uLlxuICogSG9va3MgKCouaG9vay50cykgYW5kIHN0YXRlIG1hY2hpbmVzICgqLnN0YXRlLnRzKSBhcmUgZXhjbHVkZWQgXHUyMDE0XG4gKiB0aGV5IGFyZSBhdXRvLWFzc29jaWF0ZWQgYnkgbmFtaW5nIGNvbnZlbnRpb24gYXQgcnVudGltZS5cbiAqL1xuZXhwb3J0IHsgQWNjb3VudCB9IGZyb20gJy4vYWNjb3VudC5vYmplY3QnO1xuZXhwb3J0IHsgQ2FtcGFpZ24gfSBmcm9tICcuL2NhbXBhaWduLm9iamVjdCc7XG5leHBvcnQgeyBDYXNlIH0gZnJvbSAnLi9jYXNlLm9iamVjdCc7XG5leHBvcnQgeyBDb250YWN0IH0gZnJvbSAnLi9jb250YWN0Lm9iamVjdCc7XG5leHBvcnQgeyBDb250cmFjdCB9IGZyb20gJy4vY29udHJhY3Qub2JqZWN0JztcbmV4cG9ydCB7IExlYWQgfSBmcm9tICcuL2xlYWQub2JqZWN0JztcbmV4cG9ydCB7IE9wcG9ydHVuaXR5IH0gZnJvbSAnLi9vcHBvcnR1bml0eS5vYmplY3QnO1xuZXhwb3J0IHsgUHJvZHVjdCB9IGZyb20gJy4vcHJvZHVjdC5vYmplY3QnO1xuZXhwb3J0IHsgUXVvdGUgfSBmcm9tICcuL3F1b3RlLm9iamVjdCc7XG5leHBvcnQgeyBUYXNrIH0gZnJvbSAnLi90YXNrLm9iamVjdCc7XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9vYmplY3RzL2FjY291bnQub2JqZWN0LnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL29iamVjdHNcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvb2JqZWN0cy9hY2NvdW50Lm9iamVjdC50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuaW1wb3J0IHsgT2JqZWN0U2NoZW1hLCBGaWVsZCB9IGZyb20gJ0BvYmplY3RzdGFjay9zcGVjL2RhdGEnO1xuXG5leHBvcnQgY29uc3QgQWNjb3VudCA9IE9iamVjdFNjaGVtYS5jcmVhdGUoe1xuICBuYW1lOiAnYWNjb3VudCcsXG4gIGxhYmVsOiAnQWNjb3VudCcsXG4gIHBsdXJhbExhYmVsOiAnQWNjb3VudHMnLFxuICBpY29uOiAnYnVpbGRpbmcnLFxuICBkZXNjcmlwdGlvbjogJ0NvbXBhbmllcyBhbmQgb3JnYW5pemF0aW9ucyBkb2luZyBidXNpbmVzcyB3aXRoIHVzJyxcbiAgdGl0bGVGb3JtYXQ6ICd7YWNjb3VudF9udW1iZXJ9IC0ge25hbWV9JyxcbiAgY29tcGFjdExheW91dDogWydhY2NvdW50X251bWJlcicsICduYW1lJywgJ3R5cGUnLCAnb3duZXInXSxcbiAgXG4gIGZpZWxkczoge1xuICAgIC8vIEF1dG9OdW1iZXIgZmllbGQgLSBVbmlxdWUgYWNjb3VudCBpZGVudGlmaWVyXG4gICAgYWNjb3VudF9udW1iZXI6IEZpZWxkLmF1dG9udW1iZXIoe1xuICAgICAgbGFiZWw6ICdBY2NvdW50IE51bWJlcicsXG4gICAgICBmb3JtYXQ6ICdBQ0MtezAwMDB9JyxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBCYXNpYyBJbmZvcm1hdGlvblxuICAgIG5hbWU6IEZpZWxkLnRleHQoeyBcbiAgICAgIGxhYmVsOiAnQWNjb3VudCBOYW1lJywgXG4gICAgICByZXF1aXJlZDogdHJ1ZSwgXG4gICAgICBzZWFyY2hhYmxlOiB0cnVlLFxuICAgICAgbWF4TGVuZ3RoOiAyNTUsXG4gICAgfSksXG4gICAgXG4gICAgLy8gU2VsZWN0IGZpZWxkcyB3aXRoIGN1c3RvbSBvcHRpb25zXG4gICAgdHlwZTogRmllbGQuc2VsZWN0KHtcbiAgICAgIGxhYmVsOiAnQWNjb3VudCBUeXBlJyxcbiAgICAgIG9wdGlvbnM6IFtcbiAgICAgICAgeyBsYWJlbDogJ1Byb3NwZWN0JywgdmFsdWU6ICdwcm9zcGVjdCcsIGNvbG9yOiAnI0ZGQTUwMCcsIGRlZmF1bHQ6IHRydWUgfSxcbiAgICAgICAgeyBsYWJlbDogJ0N1c3RvbWVyJywgdmFsdWU6ICdjdXN0b21lcicsIGNvbG9yOiAnIzAwQUEwMCcgfSxcbiAgICAgICAgeyBsYWJlbDogJ1BhcnRuZXInLCB2YWx1ZTogJ3BhcnRuZXInLCBjb2xvcjogJyMwMDAwRkYnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdGb3JtZXIgQ3VzdG9tZXInLCB2YWx1ZTogJ2Zvcm1lcicsIGNvbG9yOiAnIzk5OTk5OScgfSxcbiAgICAgIF1cbiAgICB9KSxcbiAgICBcbiAgICBpbmR1c3RyeTogRmllbGQuc2VsZWN0KHtcbiAgICAgIGxhYmVsOiAnSW5kdXN0cnknLFxuICAgICAgb3B0aW9uczogW1xuICAgICAgICB7IGxhYmVsOiAnVGVjaG5vbG9neScsIHZhbHVlOiAndGVjaG5vbG9neScgfSxcbiAgICAgICAgeyBsYWJlbDogJ0ZpbmFuY2UnLCB2YWx1ZTogJ2ZpbmFuY2UnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdIZWFsdGhjYXJlJywgdmFsdWU6ICdoZWFsdGhjYXJlJyB9LFxuICAgICAgICB7IGxhYmVsOiAnUmV0YWlsJywgdmFsdWU6ICdyZXRhaWwnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdNYW51ZmFjdHVyaW5nJywgdmFsdWU6ICdtYW51ZmFjdHVyaW5nJyB9LFxuICAgICAgICB7IGxhYmVsOiAnRWR1Y2F0aW9uJywgdmFsdWU6ICdlZHVjYXRpb24nIH0sXG4gICAgICBdXG4gICAgfSksXG4gICAgXG4gICAgLy8gTnVtYmVyIGZpZWxkc1xuICAgIGFubnVhbF9yZXZlbnVlOiBGaWVsZC5jdXJyZW5jeSh7IFxuICAgICAgbGFiZWw6ICdBbm51YWwgUmV2ZW51ZScsXG4gICAgICBzY2FsZTogMixcbiAgICAgIG1pbjogMCxcbiAgICB9KSxcbiAgICBcbiAgICBudW1iZXJfb2ZfZW1wbG95ZWVzOiBGaWVsZC5udW1iZXIoe1xuICAgICAgbGFiZWw6ICdFbXBsb3llZXMnLFxuICAgICAgbWluOiAwLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIENvbnRhY3QgSW5mb3JtYXRpb25cbiAgICBwaG9uZTogRmllbGQudGV4dCh7IFxuICAgICAgbGFiZWw6ICdQaG9uZScsXG4gICAgICBmb3JtYXQ6ICdwaG9uZScsXG4gICAgfSksXG4gICAgXG4gICAgd2Vic2l0ZTogRmllbGQudXJsKHtcbiAgICAgIGxhYmVsOiAnV2Vic2l0ZScsXG4gICAgfSksXG4gICAgXG4gICAgLy8gU3RydWN0dXJlZCBBZGRyZXNzIGZpZWxkIChuZXcgZmllbGQgdHlwZSlcbiAgICBiaWxsaW5nX2FkZHJlc3M6IEZpZWxkLmFkZHJlc3Moe1xuICAgICAgbGFiZWw6ICdCaWxsaW5nIEFkZHJlc3MnLFxuICAgICAgYWRkcmVzc0Zvcm1hdDogJ2ludGVybmF0aW9uYWwnLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIE9mZmljZSBMb2NhdGlvbiAobmV3IGZpZWxkIHR5cGUpXG4gICAgb2ZmaWNlX2xvY2F0aW9uOiBGaWVsZC5sb2NhdGlvbih7XG4gICAgICBsYWJlbDogJ09mZmljZSBMb2NhdGlvbicsXG4gICAgICBkaXNwbGF5TWFwOiB0cnVlLFxuICAgICAgYWxsb3dHZW9jb2Rpbmc6IHRydWUsXG4gICAgfSksXG4gICAgXG4gICAgLy8gUmVsYXRpb25zaGlwIGZpZWxkc1xuICAgIG93bmVyOiBGaWVsZC5sb29rdXAoJ3VzZXInLCB7XG4gICAgICBsYWJlbDogJ0FjY291bnQgT3duZXInLFxuICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgfSksXG4gICAgXG4gICAgcGFyZW50X2FjY291bnQ6IEZpZWxkLmxvb2t1cCgnYWNjb3VudCcsIHtcbiAgICAgIGxhYmVsOiAnUGFyZW50IEFjY291bnQnLFxuICAgICAgZGVzY3JpcHRpb246ICdQYXJlbnQgY29tcGFueSBpbiBoaWVyYXJjaHknLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIFJpY2ggdGV4dCBmaWVsZFxuICAgIGRlc2NyaXB0aW9uOiBGaWVsZC5tYXJrZG93bih7XG4gICAgICBsYWJlbDogJ0Rlc2NyaXB0aW9uJyxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBCb29sZWFuIGZpZWxkXG4gICAgaXNfYWN0aXZlOiBGaWVsZC5ib29sZWFuKHtcbiAgICAgIGxhYmVsOiAnQWN0aXZlJyxcbiAgICAgIGRlZmF1bHRWYWx1ZTogdHJ1ZSxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBEYXRlIGZpZWxkXG4gICAgbGFzdF9hY3Rpdml0eV9kYXRlOiBGaWVsZC5kYXRlKHtcbiAgICAgIGxhYmVsOiAnTGFzdCBBY3Rpdml0eSBEYXRlJyxcbiAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIEJyYW5kIGNvbG9yIChuZXcgZmllbGQgdHlwZSlcbiAgICBicmFuZF9jb2xvcjogRmllbGQuY29sb3Ioe1xuICAgICAgbGFiZWw6ICdCcmFuZCBDb2xvcicsXG4gICAgICBjb2xvckZvcm1hdDogJ2hleCcsXG4gICAgICBwcmVzZXRDb2xvcnM6IFsnI0ZGMDAwMCcsICcjMDBGRjAwJywgJyMwMDAwRkYnLCAnI0ZGRkYwMCcsICcjRkYwMEZGJywgJyMwMEZGRkYnXSxcbiAgICB9KSxcbiAgfSxcbiAgXG4gIC8vIERhdGFiYXNlIGluZGV4ZXMgZm9yIHBlcmZvcm1hbmNlXG4gIGluZGV4ZXM6IFtcbiAgICB7IGZpZWxkczogWyduYW1lJ10sIHVuaXF1ZTogZmFsc2UgfSxcbiAgICB7IGZpZWxkczogWydvd25lciddLCB1bmlxdWU6IGZhbHNlIH0sXG4gICAgeyBmaWVsZHM6IFsndHlwZScsICdpc19hY3RpdmUnXSwgdW5pcXVlOiBmYWxzZSB9LFxuICBdLFxuICBcbiAgLy8gRW5hYmxlIGFkdmFuY2VkIGZlYXR1cmVzXG4gIGVuYWJsZToge1xuICAgIHRyYWNrSGlzdG9yeTogdHJ1ZSwgICAgIC8vIFRyYWNrIGZpZWxkIGNoYW5nZXNcbiAgICBzZWFyY2hhYmxlOiB0cnVlLCAgICAgICAvLyBJbmNsdWRlIGluIGdsb2JhbCBzZWFyY2hcbiAgICBhcGlFbmFibGVkOiB0cnVlLCAgICAgICAvLyBFeHBvc2UgdmlhIFJFU1QvR3JhcGhRTFxuICAgIGFwaU1ldGhvZHM6IFsnZ2V0JywgJ2xpc3QnLCAnY3JlYXRlJywgJ3VwZGF0ZScsICdkZWxldGUnLCAnc2VhcmNoJywgJ2V4cG9ydCddLCAvLyBXaGl0ZWxpc3QgYWxsb3dlZCBBUEkgb3BlcmF0aW9uc1xuICAgIGZpbGVzOiB0cnVlLCAgICAgICAgICAgIC8vIEFsbG93IGZpbGUgYXR0YWNobWVudHNcbiAgICBmZWVkczogdHJ1ZSwgICAgICAgICAgICAvLyBFbmFibGUgYWN0aXZpdHkgZmVlZC9jaGF0dGVyIChDaGF0dGVyLWxpa2UpXG4gICAgYWN0aXZpdGllczogdHJ1ZSwgICAgICAgLy8gRW5hYmxlIHRhc2tzIGFuZCBldmVudHMgdHJhY2tpbmdcbiAgICB0cmFzaDogdHJ1ZSwgICAgICAgICAgICAvLyBSZWN5Y2xlIGJpbiBzdXBwb3J0XG4gICAgbXJ1OiB0cnVlLCAgICAgICAgICAgICAgLy8gVHJhY2sgTW9zdCBSZWNlbnRseSBVc2VkXG4gIH0sXG4gIFxuICAvLyBWYWxpZGF0aW9uIFJ1bGVzXG4gIHZhbGlkYXRpb25zOiBbXG4gICAge1xuICAgICAgbmFtZTogJ3JldmVudWVfcG9zaXRpdmUnLFxuICAgICAgdHlwZTogJ3NjcmlwdCcsXG4gICAgICBzZXZlcml0eTogJ2Vycm9yJyxcbiAgICAgIG1lc3NhZ2U6ICdBbm51YWwgUmV2ZW51ZSBtdXN0IGJlIHBvc2l0aXZlJyxcbiAgICAgIGNvbmRpdGlvbjogJ2FubnVhbF9yZXZlbnVlIDwgMCcsXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiAnYWNjb3VudF9uYW1lX3VuaXF1ZScsXG4gICAgICB0eXBlOiAndW5pcXVlJyxcbiAgICAgIHNldmVyaXR5OiAnZXJyb3InLFxuICAgICAgbWVzc2FnZTogJ0FjY291bnQgbmFtZSBtdXN0IGJlIHVuaXF1ZScsXG4gICAgICBmaWVsZHM6IFsnbmFtZSddLFxuICAgICAgY2FzZVNlbnNpdGl2ZTogZmFsc2UsXG4gICAgfSxcbiAgXSxcbiAgXG4gIC8vIFdvcmtmbG93IFJ1bGVzXG4gIHdvcmtmbG93czogW1xuICAgIHtcbiAgICAgIG5hbWU6ICd1cGRhdGVfbGFzdF9hY3Rpdml0eScsXG4gICAgICBvYmplY3ROYW1lOiAnYWNjb3VudCcsXG4gICAgICB0cmlnZ2VyVHlwZTogJ29uX3VwZGF0ZScsXG4gICAgICBjcml0ZXJpYTogJ0lTQ0hBTkdFRChvd25lcikgT1IgSVNDSEFOR0VEKHR5cGUpJyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICdzZXRfYWN0aXZpdHlfZGF0ZScsXG4gICAgICAgICAgdHlwZTogJ2ZpZWxkX3VwZGF0ZScsXG4gICAgICAgICAgZmllbGQ6ICdsYXN0X2FjdGl2aXR5X2RhdGUnLFxuICAgICAgICAgIHZhbHVlOiAnVE9EQVkoKScsXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgICBhY3RpdmU6IHRydWUsXG4gICAgfVxuICBdLFxufSk7IiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvb2JqZWN0cy9jYW1wYWlnbi5vYmplY3QudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvb2JqZWN0c1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9vYmplY3RzL2NhbXBhaWduLm9iamVjdC50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuaW1wb3J0IHsgT2JqZWN0U2NoZW1hLCBGaWVsZCB9IGZyb20gJ0BvYmplY3RzdGFjay9zcGVjL2RhdGEnO1xuXG4vKipcbiAqIENhbXBhaWduIE9iamVjdFxuICogUmVwcmVzZW50cyBtYXJrZXRpbmcgY2FtcGFpZ25zXG4gKi9cbmV4cG9ydCBjb25zdCBDYW1wYWlnbiA9IE9iamVjdFNjaGVtYS5jcmVhdGUoe1xuICBuYW1lOiAnY2FtcGFpZ24nLFxuICBsYWJlbDogJ0NhbXBhaWduJyxcbiAgcGx1cmFsTGFiZWw6ICdDYW1wYWlnbnMnLFxuICBpY29uOiAnbWVnYXBob25lJyxcbiAgZGVzY3JpcHRpb246ICdNYXJrZXRpbmcgY2FtcGFpZ25zIGFuZCBpbml0aWF0aXZlcycsXG4gIHRpdGxlRm9ybWF0OiAne2NhbXBhaWduX2NvZGV9IC0ge25hbWV9JyxcbiAgY29tcGFjdExheW91dDogWydjYW1wYWlnbl9jb2RlJywgJ25hbWUnLCAndHlwZScsICdzdGF0dXMnLCAnc3RhcnRfZGF0ZSddLFxuICBcbiAgZmllbGRzOiB7XG4gICAgLy8gQXV0b051bWJlciBmaWVsZFxuICAgIGNhbXBhaWduX2NvZGU6IEZpZWxkLmF1dG9udW1iZXIoe1xuICAgICAgbGFiZWw6ICdDYW1wYWlnbiBDb2RlJyxcbiAgICAgIGZvcm1hdDogJ0NQRy17MDAwMH0nLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIEJhc2ljIEluZm9ybWF0aW9uXG4gICAgbmFtZTogRmllbGQudGV4dCh7IFxuICAgICAgbGFiZWw6ICdDYW1wYWlnbiBOYW1lJywgXG4gICAgICByZXF1aXJlZDogdHJ1ZSwgXG4gICAgICBzZWFyY2hhYmxlOiB0cnVlLFxuICAgICAgbWF4TGVuZ3RoOiAyNTUsXG4gICAgfSksXG4gICAgXG4gICAgZGVzY3JpcHRpb246IEZpZWxkLm1hcmtkb3duKHtcbiAgICAgIGxhYmVsOiAnRGVzY3JpcHRpb24nLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIFR5cGUgJiBDaGFubmVsXG4gICAgdHlwZTogRmllbGQuc2VsZWN0KHtcbiAgICAgIGxhYmVsOiAnQ2FtcGFpZ24gVHlwZScsXG4gICAgICBvcHRpb25zOiBbXG4gICAgICAgIHsgbGFiZWw6ICdFbWFpbCcsIHZhbHVlOiAnZW1haWwnLCBkZWZhdWx0OiB0cnVlIH0sXG4gICAgICAgIHsgbGFiZWw6ICdXZWJpbmFyJywgdmFsdWU6ICd3ZWJpbmFyJyB9LFxuICAgICAgICB7IGxhYmVsOiAnVHJhZGUgU2hvdycsIHZhbHVlOiAndHJhZGVfc2hvdycgfSxcbiAgICAgICAgeyBsYWJlbDogJ0NvbmZlcmVuY2UnLCB2YWx1ZTogJ2NvbmZlcmVuY2UnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdEaXJlY3QgTWFpbCcsIHZhbHVlOiAnZGlyZWN0X21haWwnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdTb2NpYWwgTWVkaWEnLCB2YWx1ZTogJ3NvY2lhbF9tZWRpYScgfSxcbiAgICAgICAgeyBsYWJlbDogJ0NvbnRlbnQgTWFya2V0aW5nJywgdmFsdWU6ICdjb250ZW50JyB9LFxuICAgICAgICB7IGxhYmVsOiAnUGFydG5lciBNYXJrZXRpbmcnLCB2YWx1ZTogJ3BhcnRuZXInIH0sXG4gICAgICBdXG4gICAgfSksXG4gICAgXG4gICAgY2hhbm5lbDogRmllbGQuc2VsZWN0KHtcbiAgICAgIGxhYmVsOiAnUHJpbWFyeSBDaGFubmVsJyxcbiAgICAgIG9wdGlvbnM6IFtcbiAgICAgICAgeyBsYWJlbDogJ0RpZ2l0YWwnLCB2YWx1ZTogJ2RpZ2l0YWwnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdTb2NpYWwnLCB2YWx1ZTogJ3NvY2lhbCcgfSxcbiAgICAgICAgeyBsYWJlbDogJ0VtYWlsJywgdmFsdWU6ICdlbWFpbCcgfSxcbiAgICAgICAgeyBsYWJlbDogJ0V2ZW50cycsIHZhbHVlOiAnZXZlbnRzJyB9LFxuICAgICAgICB7IGxhYmVsOiAnUGFydG5lcicsIHZhbHVlOiAncGFydG5lcicgfSxcbiAgICAgIF1cbiAgICB9KSxcbiAgICBcbiAgICAvLyBTdGF0dXNcbiAgICBzdGF0dXM6IEZpZWxkLnNlbGVjdCh7XG4gICAgICBsYWJlbDogJ1N0YXR1cycsXG4gICAgICBvcHRpb25zOiBbXG4gICAgICAgIHsgbGFiZWw6ICdQbGFubmluZycsIHZhbHVlOiAncGxhbm5pbmcnLCBjb2xvcjogJyM5OTk5OTknLCBkZWZhdWx0OiB0cnVlIH0sXG4gICAgICAgIHsgbGFiZWw6ICdJbiBQcm9ncmVzcycsIHZhbHVlOiAnaW5fcHJvZ3Jlc3MnLCBjb2xvcjogJyNGRkE1MDAnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdDb21wbGV0ZWQnLCB2YWx1ZTogJ2NvbXBsZXRlZCcsIGNvbG9yOiAnIzAwQUEwMCcgfSxcbiAgICAgICAgeyBsYWJlbDogJ0Fib3J0ZWQnLCB2YWx1ZTogJ2Fib3J0ZWQnLCBjb2xvcjogJyNGRjAwMDAnIH0sXG4gICAgICBdLFxuICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgfSksXG4gICAgXG4gICAgLy8gRGF0ZXNcbiAgICBzdGFydF9kYXRlOiBGaWVsZC5kYXRlKHtcbiAgICAgIGxhYmVsOiAnU3RhcnQgRGF0ZScsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICB9KSxcbiAgICBcbiAgICBlbmRfZGF0ZTogRmllbGQuZGF0ZSh7XG4gICAgICBsYWJlbDogJ0VuZCBEYXRlJyxcbiAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIEJ1ZGdldCAmIFJPSVxuICAgIGJ1ZGdldGVkX2Nvc3Q6IEZpZWxkLmN1cnJlbmN5KHsgXG4gICAgICBsYWJlbDogJ0J1ZGdldGVkIENvc3QnLFxuICAgICAgc2NhbGU6IDIsXG4gICAgICBtaW46IDAsXG4gICAgfSksXG4gICAgXG4gICAgYWN0dWFsX2Nvc3Q6IEZpZWxkLmN1cnJlbmN5KHsgXG4gICAgICBsYWJlbDogJ0FjdHVhbCBDb3N0JyxcbiAgICAgIHNjYWxlOiAyLFxuICAgICAgbWluOiAwLFxuICAgIH0pLFxuICAgIFxuICAgIGV4cGVjdGVkX3JldmVudWU6IEZpZWxkLmN1cnJlbmN5KHsgXG4gICAgICBsYWJlbDogJ0V4cGVjdGVkIFJldmVudWUnLFxuICAgICAgc2NhbGU6IDIsXG4gICAgICBtaW46IDAsXG4gICAgfSksXG4gICAgXG4gICAgYWN0dWFsX3JldmVudWU6IEZpZWxkLmN1cnJlbmN5KHsgXG4gICAgICBsYWJlbDogJ0FjdHVhbCBSZXZlbnVlJyxcbiAgICAgIHNjYWxlOiAyLFxuICAgICAgbWluOiAwLFxuICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgfSksXG4gICAgXG4gICAgLy8gTWV0cmljc1xuICAgIHRhcmdldF9zaXplOiBGaWVsZC5udW1iZXIoe1xuICAgICAgbGFiZWw6ICdUYXJnZXQgU2l6ZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RhcmdldCBudW1iZXIgb2YgbGVhZHMvY29udGFjdHMnLFxuICAgICAgbWluOiAwLFxuICAgIH0pLFxuICAgIFxuICAgIG51bV9zZW50OiBGaWVsZC5udW1iZXIoe1xuICAgICAgbGFiZWw6ICdOdW1iZXIgU2VudCcsXG4gICAgICBtaW46IDAsXG4gICAgICByZWFkb25seTogdHJ1ZSxcbiAgICB9KSxcbiAgICBcbiAgICBudW1fcmVzcG9uc2VzOiBGaWVsZC5udW1iZXIoe1xuICAgICAgbGFiZWw6ICdOdW1iZXIgb2YgUmVzcG9uc2VzJyxcbiAgICAgIG1pbjogMCxcbiAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIG51bV9sZWFkczogRmllbGQubnVtYmVyKHtcbiAgICAgIGxhYmVsOiAnTnVtYmVyIG9mIExlYWRzJyxcbiAgICAgIG1pbjogMCxcbiAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIG51bV9jb252ZXJ0ZWRfbGVhZHM6IEZpZWxkLm51bWJlcih7XG4gICAgICBsYWJlbDogJ0NvbnZlcnRlZCBMZWFkcycsXG4gICAgICBtaW46IDAsXG4gICAgICByZWFkb25seTogdHJ1ZSxcbiAgICB9KSxcbiAgICBcbiAgICBudW1fb3Bwb3J0dW5pdGllczogRmllbGQubnVtYmVyKHtcbiAgICAgIGxhYmVsOiAnT3Bwb3J0dW5pdGllcyBDcmVhdGVkJyxcbiAgICAgIG1pbjogMCxcbiAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIG51bV93b25fb3Bwb3J0dW5pdGllczogRmllbGQubnVtYmVyKHtcbiAgICAgIGxhYmVsOiAnV29uIE9wcG9ydHVuaXRpZXMnLFxuICAgICAgbWluOiAwLFxuICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgfSksXG4gICAgXG4gICAgLy8gQ2FsY3VsYXRlZCBNZXRyaWNzIChGb3JtdWxhIEZpZWxkcylcbiAgICByZXNwb25zZV9yYXRlOiBGaWVsZC5mb3JtdWxhKHtcbiAgICAgIGxhYmVsOiAnUmVzcG9uc2UgUmF0ZSAlJyxcbiAgICAgIGV4cHJlc3Npb246ICdJRihudW1fc2VudCA+IDAsIChudW1fcmVzcG9uc2VzIC8gbnVtX3NlbnQpICogMTAwLCAwKScsXG4gICAgICBzY2FsZTogMixcbiAgICB9KSxcbiAgICBcbiAgICByb2k6IEZpZWxkLmZvcm11bGEoe1xuICAgICAgbGFiZWw6ICdST0kgJScsXG4gICAgICBleHByZXNzaW9uOiAnSUYoYWN0dWFsX2Nvc3QgPiAwLCAoKGFjdHVhbF9yZXZlbnVlIC0gYWN0dWFsX2Nvc3QpIC8gYWN0dWFsX2Nvc3QpICogMTAwLCAwKScsXG4gICAgICBzY2FsZTogMixcbiAgICB9KSxcbiAgICBcbiAgICAvLyBSZWxhdGlvbnNoaXBzXG4gICAgcGFyZW50X2NhbXBhaWduOiBGaWVsZC5sb29rdXAoJ2NhbXBhaWduJywge1xuICAgICAgbGFiZWw6ICdQYXJlbnQgQ2FtcGFpZ24nLFxuICAgICAgZGVzY3JpcHRpb246ICdQYXJlbnQgY2FtcGFpZ24gaW4gaGllcmFyY2h5JyxcbiAgICB9KSxcbiAgICBcbiAgICBvd25lcjogRmllbGQubG9va3VwKCd1c2VyJywge1xuICAgICAgbGFiZWw6ICdDYW1wYWlnbiBPd25lcicsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBDYW1wYWlnbiBBc3NldHNcbiAgICBsYW5kaW5nX3BhZ2VfdXJsOiBGaWVsZC51cmwoe1xuICAgICAgbGFiZWw6ICdMYW5kaW5nIFBhZ2UnLFxuICAgIH0pLFxuICAgIFxuICAgIGlzX2FjdGl2ZTogRmllbGQuYm9vbGVhbih7XG4gICAgICBsYWJlbDogJ0FjdGl2ZScsXG4gICAgICBkZWZhdWx0VmFsdWU6IHRydWUsXG4gICAgfSksXG4gIH0sXG4gIFxuICAvLyBEYXRhYmFzZSBpbmRleGVzXG4gIGluZGV4ZXM6IFtcbiAgICB7IGZpZWxkczogWyduYW1lJ10sIHVuaXF1ZTogZmFsc2UgfSxcbiAgICB7IGZpZWxkczogWyd0eXBlJ10sIHVuaXF1ZTogZmFsc2UgfSxcbiAgICB7IGZpZWxkczogWydzdGF0dXMnXSwgdW5pcXVlOiBmYWxzZSB9LFxuICAgIHsgZmllbGRzOiBbJ3N0YXJ0X2RhdGUnXSwgdW5pcXVlOiBmYWxzZSB9LFxuICAgIHsgZmllbGRzOiBbJ293bmVyJ10sIHVuaXF1ZTogZmFsc2UgfSxcbiAgXSxcbiAgXG4gIC8vIEVuYWJsZSBhZHZhbmNlZCBmZWF0dXJlc1xuICBlbmFibGU6IHtcbiAgICB0cmFja0hpc3Rvcnk6IHRydWUsXG4gICAgc2VhcmNoYWJsZTogdHJ1ZSxcbiAgICBhcGlFbmFibGVkOiB0cnVlLFxuICAgIGFwaU1ldGhvZHM6IFsnZ2V0JywgJ2xpc3QnLCAnY3JlYXRlJywgJ3VwZGF0ZScsICdkZWxldGUnLCAnc2VhcmNoJywgJ2V4cG9ydCddLFxuICAgIGZpbGVzOiB0cnVlLFxuICAgIGZlZWRzOiB0cnVlLFxuICAgIGFjdGl2aXRpZXM6IHRydWUsXG4gICAgdHJhc2g6IHRydWUsXG4gICAgbXJ1OiB0cnVlLFxuICB9LFxuICBcbiAgLy8gVmFsaWRhdGlvbiBSdWxlc1xuICB2YWxpZGF0aW9uczogW1xuICAgIHtcbiAgICAgIG5hbWU6ICdlbmRfYWZ0ZXJfc3RhcnQnLFxuICAgICAgdHlwZTogJ3NjcmlwdCcsXG4gICAgICBzZXZlcml0eTogJ2Vycm9yJyxcbiAgICAgIG1lc3NhZ2U6ICdFbmQgRGF0ZSBtdXN0IGJlIGFmdGVyIFN0YXJ0IERhdGUnLFxuICAgICAgY29uZGl0aW9uOiAnZW5kX2RhdGUgPCBzdGFydF9kYXRlJyxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICdhY3R1YWxfY29zdF93aXRoaW5fYnVkZ2V0JyxcbiAgICAgIHR5cGU6ICdzY3JpcHQnLFxuICAgICAgc2V2ZXJpdHk6ICd3YXJuaW5nJyxcbiAgICAgIG1lc3NhZ2U6ICdBY3R1YWwgQ29zdCBleGNlZWRzIEJ1ZGdldGVkIENvc3QnLFxuICAgICAgY29uZGl0aW9uOiAnYWN0dWFsX2Nvc3QgPiBidWRnZXRlZF9jb3N0JyxcbiAgICB9LFxuICBdLFxuICBcbiAgLy8gV29ya2Zsb3cgUnVsZXNcbiAgd29ya2Zsb3dzOiBbXG4gICAge1xuICAgICAgbmFtZTogJ2NhbXBhaWduX2NvbXBsZXRpb25fY2hlY2snLFxuICAgICAgb2JqZWN0TmFtZTogJ2NhbXBhaWduJyxcbiAgICAgIHRyaWdnZXJUeXBlOiAnb25fcmVhZCcsXG4gICAgICBjcml0ZXJpYTogJ2VuZF9kYXRlIDwgVE9EQVkoKSBBTkQgc3RhdHVzID0gXCJpbl9wcm9ncmVzc1wiJyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICdtYXJrX2NvbXBsZXRlZCcsXG4gICAgICAgICAgdHlwZTogJ2ZpZWxkX3VwZGF0ZScsXG4gICAgICAgICAgZmllbGQ6ICdzdGF0dXMnLFxuICAgICAgICAgIHZhbHVlOiAnXCJjb21wbGV0ZWRcIicsXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgICBhY3RpdmU6IHRydWUsXG4gICAgfVxuICBdLFxufSk7XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9vYmplY3RzL2Nhc2Uub2JqZWN0LnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL29iamVjdHNcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvb2JqZWN0cy9jYXNlLm9iamVjdC50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuaW1wb3J0IHsgT2JqZWN0U2NoZW1hLCBGaWVsZCB9IGZyb20gJ0BvYmplY3RzdGFjay9zcGVjL2RhdGEnO1xuXG5leHBvcnQgY29uc3QgQ2FzZSA9IE9iamVjdFNjaGVtYS5jcmVhdGUoe1xuICBuYW1lOiAnY2FzZScsXG4gIGxhYmVsOiAnQ2FzZScsXG4gIHBsdXJhbExhYmVsOiAnQ2FzZXMnLFxuICBpY29uOiAnbGlmZS1idW95JyxcbiAgZGVzY3JpcHRpb246ICdDdXN0b21lciBzdXBwb3J0IGNhc2VzIGFuZCBzZXJ2aWNlIHJlcXVlc3RzJyxcbiAgXG4gIGZpZWxkczoge1xuICAgIC8vIENhc2UgSW5mb3JtYXRpb25cbiAgICBjYXNlX251bWJlcjogRmllbGQuYXV0b251bWJlcih7XG4gICAgICBsYWJlbDogJ0Nhc2UgTnVtYmVyJyxcbiAgICAgIGZvcm1hdDogJ0NBU0UtezAwMDAwfScsXG4gICAgfSksXG4gICAgXG4gICAgc3ViamVjdDogRmllbGQudGV4dCh7XG4gICAgICBsYWJlbDogJ1N1YmplY3QnLFxuICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICBzZWFyY2hhYmxlOiB0cnVlLFxuICAgICAgbWF4TGVuZ3RoOiAyNTUsXG4gICAgfSksXG4gICAgXG4gICAgZGVzY3JpcHRpb246IEZpZWxkLm1hcmtkb3duKHtcbiAgICAgIGxhYmVsOiAnRGVzY3JpcHRpb24nLFxuICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgfSksXG4gICAgXG4gICAgLy8gUmVsYXRpb25zaGlwc1xuICAgIGFjY291bnQ6IEZpZWxkLmxvb2t1cCgnYWNjb3VudCcsIHtcbiAgICAgIGxhYmVsOiAnQWNjb3VudCcsXG4gICAgfSksXG4gICAgXG4gICAgY29udGFjdDogRmllbGQubG9va3VwKCdjb250YWN0Jywge1xuICAgICAgbGFiZWw6ICdDb250YWN0JyxcbiAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgcmVmZXJlbmNlRmlsdGVyczogWydhY2NvdW50ID0ge2Nhc2UuYWNjb3VudH0nXSxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBDYXNlIE1hbmFnZW1lbnRcbiAgICBzdGF0dXM6IEZpZWxkLnNlbGVjdCh7XG4gICAgICBsYWJlbDogJ1N0YXR1cycsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgIG9wdGlvbnM6IFtcbiAgICAgICAgeyBsYWJlbDogJ05ldycsIHZhbHVlOiAnbmV3JywgY29sb3I6ICcjODA4MDgwJywgZGVmYXVsdDogdHJ1ZSB9LFxuICAgICAgICB7IGxhYmVsOiAnSW4gUHJvZ3Jlc3MnLCB2YWx1ZTogJ2luX3Byb2dyZXNzJywgY29sb3I6ICcjRkZBNTAwJyB9LFxuICAgICAgICB7IGxhYmVsOiAnV2FpdGluZyBvbiBDdXN0b21lcicsIHZhbHVlOiAnd2FpdGluZ19jdXN0b21lcicsIGNvbG9yOiAnI0ZGRDcwMCcgfSxcbiAgICAgICAgeyBsYWJlbDogJ1dhaXRpbmcgb24gU3VwcG9ydCcsIHZhbHVlOiAnd2FpdGluZ19zdXBwb3J0JywgY29sb3I6ICcjNDE2OUUxJyB9LFxuICAgICAgICB7IGxhYmVsOiAnRXNjYWxhdGVkJywgdmFsdWU6ICdlc2NhbGF0ZWQnLCBjb2xvcjogJyNGRjAwMDAnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdSZXNvbHZlZCcsIHZhbHVlOiAncmVzb2x2ZWQnLCBjb2xvcjogJyMwMEFBMDAnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdDbG9zZWQnLCB2YWx1ZTogJ2Nsb3NlZCcsIGNvbG9yOiAnIzAwNjQwMCcgfSxcbiAgICAgIF1cbiAgICB9KSxcbiAgICBcbiAgICBwcmlvcml0eTogRmllbGQuc2VsZWN0KHtcbiAgICAgIGxhYmVsOiAnUHJpb3JpdHknLFxuICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICBvcHRpb25zOiBbXG4gICAgICAgIHsgbGFiZWw6ICdMb3cnLCB2YWx1ZTogJ2xvdycsIGNvbG9yOiAnIzQxNjlFMScsIGRlZmF1bHQ6IHRydWUgfSxcbiAgICAgICAgeyBsYWJlbDogJ01lZGl1bScsIHZhbHVlOiAnbWVkaXVtJywgY29sb3I6ICcjRkZBNTAwJyB9LFxuICAgICAgICB7IGxhYmVsOiAnSGlnaCcsIHZhbHVlOiAnaGlnaCcsIGNvbG9yOiAnI0ZGNDUwMCcgfSxcbiAgICAgICAgeyBsYWJlbDogJ0NyaXRpY2FsJywgdmFsdWU6ICdjcml0aWNhbCcsIGNvbG9yOiAnI0ZGMDAwMCcgfSxcbiAgICAgIF1cbiAgICB9KSxcbiAgICBcbiAgICB0eXBlOiBGaWVsZC5zZWxlY3QoWydRdWVzdGlvbicsICdQcm9ibGVtJywgJ0ZlYXR1cmUgUmVxdWVzdCcsICdCdWcnXSwge1xuICAgICAgbGFiZWw6ICdDYXNlIFR5cGUnLFxuICAgIH0pLFxuICAgIFxuICAgIG9yaWdpbjogRmllbGQuc2VsZWN0KFsnRW1haWwnLCAnUGhvbmUnLCAnV2ViJywgJ0NoYXQnLCAnU29jaWFsIE1lZGlhJ10sIHtcbiAgICAgIGxhYmVsOiAnQ2FzZSBPcmlnaW4nLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIEFzc2lnbm1lbnRcbiAgICBvd25lcjogRmllbGQubG9va3VwKCd1c2VyJywge1xuICAgICAgbGFiZWw6ICdDYXNlIE93bmVyJyxcbiAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIFNMQSBhbmQgTWV0cmljc1xuICAgIGNyZWF0ZWRfZGF0ZTogRmllbGQuZGF0ZXRpbWUoe1xuICAgICAgbGFiZWw6ICdDcmVhdGVkIERhdGUnLFxuICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgfSksXG4gICAgXG4gICAgY2xvc2VkX2RhdGU6IEZpZWxkLmRhdGV0aW1lKHtcbiAgICAgIGxhYmVsOiAnQ2xvc2VkIERhdGUnLFxuICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgfSksXG4gICAgXG4gICAgZmlyc3RfcmVzcG9uc2VfZGF0ZTogRmllbGQuZGF0ZXRpbWUoe1xuICAgICAgbGFiZWw6ICdGaXJzdCBSZXNwb25zZSBEYXRlJyxcbiAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIHJlc29sdXRpb25fdGltZV9ob3VyczogRmllbGQubnVtYmVyKHtcbiAgICAgIGxhYmVsOiAnUmVzb2x1dGlvbiBUaW1lIChIb3VycyknLFxuICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgICBzY2FsZTogMixcbiAgICB9KSxcbiAgICBcbiAgICBzbGFfZHVlX2RhdGU6IEZpZWxkLmRhdGV0aW1lKHtcbiAgICAgIGxhYmVsOiAnU0xBIER1ZSBEYXRlJyxcbiAgICB9KSxcbiAgICBcbiAgICBpc19zbGFfdmlvbGF0ZWQ6IEZpZWxkLmJvb2xlYW4oe1xuICAgICAgbGFiZWw6ICdTTEEgVmlvbGF0ZWQnLFxuICAgICAgZGVmYXVsdFZhbHVlOiBmYWxzZSxcbiAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIEVzY2FsYXRpb25cbiAgICBpc19lc2NhbGF0ZWQ6IEZpZWxkLmJvb2xlYW4oe1xuICAgICAgbGFiZWw6ICdFc2NhbGF0ZWQnLFxuICAgICAgZGVmYXVsdFZhbHVlOiBmYWxzZSxcbiAgICB9KSxcbiAgICBcbiAgICBlc2NhbGF0aW9uX3JlYXNvbjogRmllbGQudGV4dGFyZWEoe1xuICAgICAgbGFiZWw6ICdFc2NhbGF0aW9uIFJlYXNvbicsXG4gICAgfSksXG4gICAgXG4gICAgLy8gUmVsYXRlZCBjYXNlXG4gICAgcGFyZW50X2Nhc2U6IEZpZWxkLmxvb2t1cCgnY2FzZScsIHtcbiAgICAgIGxhYmVsOiAnUGFyZW50IENhc2UnLFxuICAgICAgZGVzY3JpcHRpb246ICdSZWxhdGVkIHBhcmVudCBjYXNlJyxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBSZXNvbHV0aW9uXG4gICAgcmVzb2x1dGlvbjogRmllbGQubWFya2Rvd24oe1xuICAgICAgbGFiZWw6ICdSZXNvbHV0aW9uJyxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBDdXN0b21lciBzYXRpc2ZhY3Rpb25cbiAgICBjdXN0b21lcl9yYXRpbmc6IEZpZWxkLnJhdGluZyg1LCB7XG4gICAgICBsYWJlbDogJ0N1c3RvbWVyIFNhdGlzZmFjdGlvbicsXG4gICAgICBkZXNjcmlwdGlvbjogJ0N1c3RvbWVyIHNhdGlzZmFjdGlvbiByYXRpbmcgKDEtNSBzdGFycyknLFxuICAgIH0pLFxuICAgIFxuICAgIGN1c3RvbWVyX2ZlZWRiYWNrOiBGaWVsZC50ZXh0YXJlYSh7XG4gICAgICBsYWJlbDogJ0N1c3RvbWVyIEZlZWRiYWNrJyxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBDdXN0b21lciBzaWduYXR1cmUgKGZvciBjYXNlIHJlc29sdXRpb24gYWNrbm93bGVkZ21lbnQpXG4gICAgY3VzdG9tZXJfc2lnbmF0dXJlOiBGaWVsZC5zaWduYXR1cmUoe1xuICAgICAgbGFiZWw6ICdDdXN0b21lciBTaWduYXR1cmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdEaWdpdGFsIHNpZ25hdHVyZSBhY2tub3dsZWRnaW5nIGNhc2UgcmVzb2x1dGlvbicsXG4gICAgfSksXG4gICAgXG4gICAgLy8gSW50ZXJuYWwgbm90ZXNcbiAgICBpbnRlcm5hbF9ub3RlczogRmllbGQubWFya2Rvd24oe1xuICAgICAgbGFiZWw6ICdJbnRlcm5hbCBOb3RlcycsXG4gICAgICBkZXNjcmlwdGlvbjogJ0ludGVybmFsIG5vdGVzIG5vdCB2aXNpYmxlIHRvIGN1c3RvbWVyJyxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBGbGFnc1xuICAgIGlzX2Nsb3NlZDogRmllbGQuYm9vbGVhbih7XG4gICAgICBsYWJlbDogJ0lzIENsb3NlZCcsXG4gICAgICBkZWZhdWx0VmFsdWU6IGZhbHNlLFxuICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgfSksXG4gIH0sXG4gIFxuICAvLyBEYXRhYmFzZSBpbmRleGVzIGZvciBwZXJmb3JtYW5jZVxuICBpbmRleGVzOiBbXG4gICAgeyBmaWVsZHM6IFsnY2FzZV9udW1iZXInXSwgdW5pcXVlOiB0cnVlIH0sXG4gICAgeyBmaWVsZHM6IFsnYWNjb3VudCddLCB1bmlxdWU6IGZhbHNlIH0sXG4gICAgeyBmaWVsZHM6IFsnb3duZXInXSwgdW5pcXVlOiBmYWxzZSB9LFxuICAgIHsgZmllbGRzOiBbJ3N0YXR1cyddLCB1bmlxdWU6IGZhbHNlIH0sXG4gICAgeyBmaWVsZHM6IFsncHJpb3JpdHknXSwgdW5pcXVlOiBmYWxzZSB9LFxuICBdLFxuICBcbiAgZW5hYmxlOiB7XG4gICAgdHJhY2tIaXN0b3J5OiB0cnVlLFxuICAgIHNlYXJjaGFibGU6IHRydWUsXG4gICAgYXBpRW5hYmxlZDogdHJ1ZSxcbiAgICBmaWxlczogdHJ1ZSxcbiAgICBmZWVkczogdHJ1ZSwgICAgICAgICAgICAvLyBFbmFibGUgc29jaWFsIGZlZWQsIGNvbW1lbnRzLCBhbmQgbWVudGlvbnNcbiAgICBhY3Rpdml0aWVzOiB0cnVlLCAgICAgICAvLyBFbmFibGUgdGFza3MgYW5kIGV2ZW50cyB0cmFja2luZ1xuICAgIHRyYXNoOiB0cnVlLFxuICAgIG1ydTogdHJ1ZSwgICAgICAgICAgICAgIC8vIFRyYWNrIE1vc3QgUmVjZW50bHkgVXNlZFxuICB9LFxuICBcbiAgdGl0bGVGb3JtYXQ6ICd7Y2FzZV9udW1iZXJ9IC0ge3N1YmplY3R9JyxcbiAgY29tcGFjdExheW91dDogWydjYXNlX251bWJlcicsICdzdWJqZWN0JywgJ2FjY291bnQnLCAnc3RhdHVzJywgJ3ByaW9yaXR5J10sXG4gIFxuICAvLyBSZW1vdmVkOiBsaXN0X3ZpZXdzIGFuZCBmb3JtX3ZpZXdzIGJlbG9uZyBpbiBVSSBjb25maWd1cmF0aW9uLCBub3Qgb2JqZWN0IGRlZmluaXRpb25cbiAgXG4gIHZhbGlkYXRpb25zOiBbXG4gICAge1xuICAgICAgbmFtZTogJ3Jlc29sdXRpb25fcmVxdWlyZWRfZm9yX2Nsb3NlZCcsXG4gICAgICB0eXBlOiAnc2NyaXB0JyxcbiAgICAgIHNldmVyaXR5OiAnZXJyb3InLFxuICAgICAgbWVzc2FnZTogJ1Jlc29sdXRpb24gaXMgcmVxdWlyZWQgd2hlbiBjbG9zaW5nIGEgY2FzZScsXG4gICAgICBjb25kaXRpb246ICdzdGF0dXMgPSBcImNsb3NlZFwiIEFORCBJU0JMQU5LKHJlc29sdXRpb24pJyxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICdlc2NhbGF0aW9uX3JlYXNvbl9yZXF1aXJlZCcsXG4gICAgICB0eXBlOiAnc2NyaXB0JyxcbiAgICAgIHNldmVyaXR5OiAnZXJyb3InLFxuICAgICAgbWVzc2FnZTogJ0VzY2FsYXRpb24gcmVhc29uIGlzIHJlcXVpcmVkIHdoZW4gZXNjYWxhdGluZyBhIGNhc2UnLFxuICAgICAgY29uZGl0aW9uOiAnaXNfZXNjYWxhdGVkID0gdHJ1ZSBBTkQgSVNCTEFOSyhlc2NhbGF0aW9uX3JlYXNvbiknLFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJ2Nhc2Vfc3RhdHVzX3Byb2dyZXNzaW9uJyxcbiAgICAgIHR5cGU6ICdzdGF0ZV9tYWNoaW5lJyxcbiAgICAgIHNldmVyaXR5OiAnd2FybmluZycsXG4gICAgICBtZXNzYWdlOiAnSW52YWxpZCBzdGF0dXMgdHJhbnNpdGlvbicsXG4gICAgICBmaWVsZDogJ3N0YXR1cycsXG4gICAgICB0cmFuc2l0aW9uczoge1xuICAgICAgICAnbmV3JzogWydpbl9wcm9ncmVzcycsICd3YWl0aW5nX2N1c3RvbWVyJywgJ2Nsb3NlZCddLFxuICAgICAgICAnaW5fcHJvZ3Jlc3MnOiBbJ3dhaXRpbmdfY3VzdG9tZXInLCAnd2FpdGluZ19zdXBwb3J0JywgJ2VzY2FsYXRlZCcsICdyZXNvbHZlZCddLFxuICAgICAgICAnd2FpdGluZ19jdXN0b21lcic6IFsnaW5fcHJvZ3Jlc3MnLCAnY2xvc2VkJ10sXG4gICAgICAgICd3YWl0aW5nX3N1cHBvcnQnOiBbJ2luX3Byb2dyZXNzJywgJ2VzY2FsYXRlZCddLFxuICAgICAgICAnZXNjYWxhdGVkJzogWydpbl9wcm9ncmVzcycsICdyZXNvbHZlZCddLFxuICAgICAgICAncmVzb2x2ZWQnOiBbJ2Nsb3NlZCcsICdpbl9wcm9ncmVzcyddLCAgLy8gQ2FuIHJlb3BlblxuICAgICAgICAnY2xvc2VkJzogWydpbl9wcm9ncmVzcyddLCAgLy8gQ2FuIHJlb3BlblxuICAgICAgfVxuICAgIH0sXG4gIF0sXG4gIFxuICB3b3JrZmxvd3M6IFtcbiAgICB7XG4gICAgICBuYW1lOiAnc2V0X2Nsb3NlZF9mbGFnJyxcbiAgICAgIG9iamVjdE5hbWU6ICdjYXNlJyxcbiAgICAgIHRyaWdnZXJUeXBlOiAnb25fY3JlYXRlX29yX3VwZGF0ZScsXG4gICAgICBjcml0ZXJpYTogJ0lTQ0hBTkdFRChzdGF0dXMpJyxcbiAgICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICd1cGRhdGVfY2xvc2VkX2ZsYWcnLFxuICAgICAgICAgIHR5cGU6ICdmaWVsZF91cGRhdGUnLFxuICAgICAgICAgIGZpZWxkOiAnaXNfY2xvc2VkJyxcbiAgICAgICAgICB2YWx1ZTogJ3N0YXR1cyA9IFwiY2xvc2VkXCInLFxuICAgICAgICB9XG4gICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJ3NldF9jbG9zZWRfZGF0ZScsXG4gICAgICBvYmplY3ROYW1lOiAnY2FzZScsXG4gICAgICB0cmlnZ2VyVHlwZTogJ29uX3VwZGF0ZScsXG4gICAgICBjcml0ZXJpYTogJ0lTQ0hBTkdFRChzdGF0dXMpIEFORCBzdGF0dXMgPSBcImNsb3NlZFwiJyxcbiAgICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICdzZXRfZGF0ZScsXG4gICAgICAgICAgdHlwZTogJ2ZpZWxkX3VwZGF0ZScsXG4gICAgICAgICAgZmllbGQ6ICdjbG9zZWRfZGF0ZScsXG4gICAgICAgICAgdmFsdWU6ICdOT1coKScsXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiAnY2FsY3VsYXRlX3Jlc29sdXRpb25fdGltZScsXG4gICAgICBvYmplY3ROYW1lOiAnY2FzZScsXG4gICAgICB0cmlnZ2VyVHlwZTogJ29uX3VwZGF0ZScsXG4gICAgICBjcml0ZXJpYTogJ0lTQ0hBTkdFRChjbG9zZWRfZGF0ZSkgQU5EIE5PVChJU0JMQU5LKGNsb3NlZF9kYXRlKSknLFxuICAgICAgYWN0aXZlOiB0cnVlLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogJ2NhbGNfdGltZScsXG4gICAgICAgICAgdHlwZTogJ2ZpZWxkX3VwZGF0ZScsXG4gICAgICAgICAgZmllbGQ6ICdyZXNvbHV0aW9uX3RpbWVfaG91cnMnLFxuICAgICAgICAgIHZhbHVlOiAnSE9VUlMoY3JlYXRlZF9kYXRlLCBjbG9zZWRfZGF0ZSknLFxuICAgICAgICB9XG4gICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJ25vdGlmeV9vbl9jcml0aWNhbCcsXG4gICAgICBvYmplY3ROYW1lOiAnY2FzZScsXG4gICAgICB0cmlnZ2VyVHlwZTogJ29uX2NyZWF0ZV9vcl91cGRhdGUnLFxuICAgICAgY3JpdGVyaWE6ICdwcmlvcml0eSA9IFwiY3JpdGljYWxcIicsXG4gICAgICBhY3RpdmU6IHRydWUsXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiAnZW1haWxfc3VwcG9ydF9tYW5hZ2VyJyxcbiAgICAgICAgICB0eXBlOiAnZW1haWxfYWxlcnQnLFxuICAgICAgICAgIHRlbXBsYXRlOiAnY3JpdGljYWxfY2FzZV9hbGVydCcsXG4gICAgICAgICAgcmVjaXBpZW50czogWydzdXBwb3J0X21hbmFnZXJAZXhhbXBsZS5jb20nXSxcbiAgICAgICAgfVxuICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICdub3RpZnlfb25fZXNjYWxhdGlvbicsXG4gICAgICBvYmplY3ROYW1lOiAnY2FzZScsXG4gICAgICB0cmlnZ2VyVHlwZTogJ29uX3VwZGF0ZScsXG4gICAgICBjcml0ZXJpYTogJ0lTQ0hBTkdFRChpc19lc2NhbGF0ZWQpIEFORCBpc19lc2NhbGF0ZWQgPSB0cnVlJyxcbiAgICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICdlbWFpbF9lc2NhbGF0aW9uX3RlYW0nLFxuICAgICAgICAgIHR5cGU6ICdlbWFpbF9hbGVydCcsXG4gICAgICAgICAgdGVtcGxhdGU6ICdjYXNlX2VzY2FsYXRpb25fYWxlcnQnLFxuICAgICAgICAgIHJlY2lwaWVudHM6IFsnZXNjYWxhdGlvbl90ZWFtQGV4YW1wbGUuY29tJ10sXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgfSxcbiAgXSxcbn0pO1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvb2JqZWN0cy9jb250YWN0Lm9iamVjdC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9vYmplY3RzXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL29iamVjdHMvY29udGFjdC5vYmplY3QudHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbmltcG9ydCB7IE9iamVjdFNjaGVtYSwgRmllbGQgfSBmcm9tICdAb2JqZWN0c3RhY2svc3BlYy9kYXRhJztcblxuZXhwb3J0IGNvbnN0IENvbnRhY3QgPSBPYmplY3RTY2hlbWEuY3JlYXRlKHtcbiAgbmFtZTogJ2NvbnRhY3QnLFxuICBsYWJlbDogJ0NvbnRhY3QnLFxuICBwbHVyYWxMYWJlbDogJ0NvbnRhY3RzJyxcbiAgaWNvbjogJ3VzZXInLFxuICBkZXNjcmlwdGlvbjogJ1Blb3BsZSBhc3NvY2lhdGVkIHdpdGggYWNjb3VudHMnLFxuICBcbiAgZmllbGRzOiB7XG4gICAgLy8gTmFtZSBmaWVsZHNcbiAgICBzYWx1dGF0aW9uOiBGaWVsZC5zZWxlY3QoWydNci4nLCAnTXMuJywgJ01ycy4nLCAnRHIuJywgJ1Byb2YuJ10sIHtcbiAgICAgIGxhYmVsOiAnU2FsdXRhdGlvbicsXG4gICAgfSksXG4gICAgZmlyc3RfbmFtZTogRmllbGQudGV4dCh7IFxuICAgICAgbGFiZWw6ICdGaXJzdCBOYW1lJyxcbiAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgc2VhcmNoYWJsZTogdHJ1ZSxcbiAgICB9KSxcbiAgICBsYXN0X25hbWU6IEZpZWxkLnRleHQoeyBcbiAgICAgIGxhYmVsOiAnTGFzdCBOYW1lJyxcbiAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgc2VhcmNoYWJsZTogdHJ1ZSxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBGb3JtdWxhIGZpZWxkIC0gRnVsbCBuYW1lXG4gICAgZnVsbF9uYW1lOiBGaWVsZC5mb3JtdWxhKHtcbiAgICAgIGxhYmVsOiAnRnVsbCBOYW1lJyxcbiAgICAgIGV4cHJlc3Npb246ICdDT05DQVQoc2FsdXRhdGlvbiwgXCIgXCIsIGZpcnN0X25hbWUsIFwiIFwiLCBsYXN0X25hbWUpJyxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBSZWxhdGlvbnNoaXA6IExpbmsgdG8gQWNjb3VudCAoTWFzdGVyLURldGFpbClcbiAgICBhY2NvdW50OiBGaWVsZC5tYXN0ZXJEZXRhaWwoJ2FjY291bnQnLCB7XG4gICAgICBsYWJlbDogJ0FjY291bnQnLFxuICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICB3cml0ZVJlcXVpcmVzTWFzdGVyUmVhZDogdHJ1ZSxcbiAgICAgIGRlbGV0ZUJlaGF2aW9yOiAnY2FzY2FkZScsICAvLyBEZWxldGUgY29udGFjdHMgd2hlbiBhY2NvdW50IGlzIGRlbGV0ZWRcbiAgICB9KSxcbiAgICBcbiAgICAvLyBDb250YWN0IEluZm9ybWF0aW9uXG4gICAgZW1haWw6IEZpZWxkLmVtYWlsKHsgXG4gICAgICBsYWJlbDogJ0VtYWlsJyxcbiAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgdW5pcXVlOiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIHBob25lOiBGaWVsZC50ZXh0KHsgXG4gICAgICBsYWJlbDogJ1Bob25lJyxcbiAgICAgIGZvcm1hdDogJ3Bob25lJyxcbiAgICB9KSxcbiAgICBcbiAgICBtb2JpbGU6IEZpZWxkLnRleHQoe1xuICAgICAgbGFiZWw6ICdNb2JpbGUnLFxuICAgICAgZm9ybWF0OiAncGhvbmUnLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIFByb2Zlc3Npb25hbCBJbmZvcm1hdGlvblxuICAgIHRpdGxlOiBGaWVsZC50ZXh0KHtcbiAgICAgIGxhYmVsOiAnSm9iIFRpdGxlJyxcbiAgICB9KSxcbiAgICBcbiAgICBkZXBhcnRtZW50OiBGaWVsZC5zZWxlY3QoWydFeGVjdXRpdmUnLCAnU2FsZXMnLCAnTWFya2V0aW5nJywgJ0VuZ2luZWVyaW5nJywgJ1N1cHBvcnQnLCAnRmluYW5jZScsICdIUicsICdPcGVyYXRpb25zJ10sIHtcbiAgICAgIGxhYmVsOiAnRGVwYXJ0bWVudCcsXG4gICAgfSksXG4gICAgXG4gICAgLy8gUmVsYXRpb25zaGlwIGZpZWxkc1xuICAgIHJlcG9ydHNfdG86IEZpZWxkLmxvb2t1cCgnY29udGFjdCcsIHtcbiAgICAgIGxhYmVsOiAnUmVwb3J0cyBUbycsXG4gICAgICBkZXNjcmlwdGlvbjogJ0RpcmVjdCBtYW5hZ2VyL3N1cGVydmlzb3InLFxuICAgIH0pLFxuICAgIFxuICAgIG93bmVyOiBGaWVsZC5sb29rdXAoJ3VzZXInLCB7XG4gICAgICBsYWJlbDogJ0NvbnRhY3QgT3duZXInLFxuICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgfSksXG4gICAgXG4gICAgLy8gTWFpbGluZyBBZGRyZXNzXG4gICAgbWFpbGluZ19zdHJlZXQ6IEZpZWxkLnRleHRhcmVhKHsgbGFiZWw6ICdNYWlsaW5nIFN0cmVldCcgfSksXG4gICAgbWFpbGluZ19jaXR5OiBGaWVsZC50ZXh0KHsgbGFiZWw6ICdNYWlsaW5nIENpdHknIH0pLFxuICAgIG1haWxpbmdfc3RhdGU6IEZpZWxkLnRleHQoeyBsYWJlbDogJ01haWxpbmcgU3RhdGUvUHJvdmluY2UnIH0pLFxuICAgIG1haWxpbmdfcG9zdGFsX2NvZGU6IEZpZWxkLnRleHQoeyBsYWJlbDogJ01haWxpbmcgUG9zdGFsIENvZGUnIH0pLFxuICAgIG1haWxpbmdfY291bnRyeTogRmllbGQudGV4dCh7IGxhYmVsOiAnTWFpbGluZyBDb3VudHJ5JyB9KSxcbiAgICBcbiAgICAvLyBBZGRpdGlvbmFsIEluZm9ybWF0aW9uXG4gICAgYmlydGhkYXRlOiBGaWVsZC5kYXRlKHtcbiAgICAgIGxhYmVsOiAnQmlydGhkYXRlJyxcbiAgICB9KSxcbiAgICBcbiAgICBsZWFkX3NvdXJjZTogRmllbGQuc2VsZWN0KFsnV2ViJywgJ1JlZmVycmFsJywgJ0V2ZW50JywgJ1BhcnRuZXInLCAnQWR2ZXJ0aXNlbWVudCddLCB7XG4gICAgICBsYWJlbDogJ0xlYWQgU291cmNlJyxcbiAgICB9KSxcbiAgICBcbiAgICBkZXNjcmlwdGlvbjogRmllbGQubWFya2Rvd24oe1xuICAgICAgbGFiZWw6ICdEZXNjcmlwdGlvbicsXG4gICAgfSksXG4gICAgXG4gICAgLy8gRmxhZ3NcbiAgICBpc19wcmltYXJ5OiBGaWVsZC5ib29sZWFuKHtcbiAgICAgIGxhYmVsOiAnUHJpbWFyeSBDb250YWN0JyxcbiAgICAgIGRlZmF1bHRWYWx1ZTogZmFsc2UsXG4gICAgICBkZXNjcmlwdGlvbjogJ0lzIHRoaXMgdGhlIG1haW4gY29udGFjdCBmb3IgdGhlIGFjY291bnQ/JyxcbiAgICB9KSxcbiAgICBcbiAgICBkb19ub3RfY2FsbDogRmllbGQuYm9vbGVhbih7XG4gICAgICBsYWJlbDogJ0RvIE5vdCBDYWxsJyxcbiAgICAgIGRlZmF1bHRWYWx1ZTogZmFsc2UsXG4gICAgfSksXG4gICAgXG4gICAgZW1haWxfb3B0X291dDogRmllbGQuYm9vbGVhbih7XG4gICAgICBsYWJlbDogJ0VtYWlsIE9wdCBPdXQnLFxuICAgICAgZGVmYXVsdFZhbHVlOiBmYWxzZSxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBBdmF0YXIgZmllbGRcbiAgICBhdmF0YXI6IEZpZWxkLmF2YXRhcih7XG4gICAgICBsYWJlbDogJ1Byb2ZpbGUgUGljdHVyZScsXG4gICAgfSksXG4gIH0sXG4gIFxuICAvLyBFbmFibGUgZmVhdHVyZXNcbiAgZW5hYmxlOiB7XG4gICAgdHJhY2tIaXN0b3J5OiB0cnVlLFxuICAgIHNlYXJjaGFibGU6IHRydWUsXG4gICAgYXBpRW5hYmxlZDogdHJ1ZSxcbiAgICBmaWxlczogdHJ1ZSxcbiAgICBmZWVkczogdHJ1ZSwgICAgICAgICAgICAvLyBFbmFibGUgc29jaWFsIGZlZWQsIGNvbW1lbnRzLCBhbmQgbWVudGlvbnNcbiAgICBhY3Rpdml0aWVzOiB0cnVlLCAgICAgICAvLyBFbmFibGUgdGFza3MgYW5kIGV2ZW50cyB0cmFja2luZ1xuICAgIHRyYXNoOiB0cnVlLFxuICAgIG1ydTogdHJ1ZSwgICAgICAgICAgICAgIC8vIFRyYWNrIE1vc3QgUmVjZW50bHkgVXNlZFxuICB9LFxuICBcbiAgLy8gRGlzcGxheSBjb25maWd1cmF0aW9uXG4gIHRpdGxlRm9ybWF0OiAne2Z1bGxfbmFtZX0nLFxuICBjb21wYWN0TGF5b3V0OiBbJ2Z1bGxfbmFtZScsICdlbWFpbCcsICdhY2NvdW50JywgJ3Bob25lJ10sXG4gIFxuICAvLyBWYWxpZGF0aW9uIFJ1bGVzXG4gIHZhbGlkYXRpb25zOiBbXG4gICAge1xuICAgICAgbmFtZTogJ2VtYWlsX3JlcXVpcmVkX2Zvcl9vcHRfaW4nLFxuICAgICAgdHlwZTogJ3NjcmlwdCcsXG4gICAgICBzZXZlcml0eTogJ2Vycm9yJyxcbiAgICAgIG1lc3NhZ2U6ICdFbWFpbCBpcyByZXF1aXJlZCB3aGVuIEVtYWlsIE9wdCBPdXQgaXMgbm90IGNoZWNrZWQnLFxuICAgICAgY29uZGl0aW9uOiAnZW1haWxfb3B0X291dCA9IGZhbHNlIEFORCBJU0JMQU5LKGVtYWlsKScsXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiAnZW1haWxfdW5pcXVlX3Blcl9hY2NvdW50JyxcbiAgICAgIHR5cGU6ICd1bmlxdWUnLFxuICAgICAgc2V2ZXJpdHk6ICdlcnJvcicsXG4gICAgICBtZXNzYWdlOiAnRW1haWwgbXVzdCBiZSB1bmlxdWUgd2l0aGluIGFuIGFjY291bnQnLFxuICAgICAgZmllbGRzOiBbJ2VtYWlsJywgJ2FjY291bnQnXSxcbiAgICAgIGNhc2VTZW5zaXRpdmU6IGZhbHNlLFxuICAgIH0sXG4gIF0sXG4gIFxuICAvLyBXb3JrZmxvdyBSdWxlc1xuICB3b3JrZmxvd3M6IFtcbiAgICB7XG4gICAgICBuYW1lOiAnd2VsY29tZV9lbWFpbCcsXG4gICAgICBvYmplY3ROYW1lOiAnY29udGFjdCcsXG4gICAgICB0cmlnZ2VyVHlwZTogJ29uX2NyZWF0ZScsXG4gICAgICBhY3RpdmU6IHRydWUsXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiAnc2VuZF93ZWxjb21lJyxcbiAgICAgICAgICB0eXBlOiAnZW1haWxfYWxlcnQnLFxuICAgICAgICAgIHRlbXBsYXRlOiAnY29udGFjdF93ZWxjb21lJyxcbiAgICAgICAgICByZWNpcGllbnRzOiBbJ3tjb250YWN0LmVtYWlsfSddLFxuICAgICAgICB9XG4gICAgICBdLFxuICAgIH1cbiAgXSxcbn0pOyIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL29iamVjdHMvY29udHJhY3Qub2JqZWN0LnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL29iamVjdHNcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvb2JqZWN0cy9jb250cmFjdC5vYmplY3QudHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbmltcG9ydCB7IE9iamVjdFNjaGVtYSwgRmllbGQgfSBmcm9tICdAb2JqZWN0c3RhY2svc3BlYy9kYXRhJztcblxuLyoqXG4gKiBDb250cmFjdCBPYmplY3RcbiAqIFJlcHJlc2VudHMgbGVnYWwgY29udHJhY3RzIHdpdGggY3VzdG9tZXJzXG4gKi9cbmV4cG9ydCBjb25zdCBDb250cmFjdCA9IE9iamVjdFNjaGVtYS5jcmVhdGUoe1xuICBuYW1lOiAnY29udHJhY3QnLFxuICBsYWJlbDogJ0NvbnRyYWN0JyxcbiAgcGx1cmFsTGFiZWw6ICdDb250cmFjdHMnLFxuICBpY29uOiAnZmlsZS1zaWduYXR1cmUnLFxuICBkZXNjcmlwdGlvbjogJ0xlZ2FsIGNvbnRyYWN0cyBhbmQgYWdyZWVtZW50cycsXG4gIHRpdGxlRm9ybWF0OiAne2NvbnRyYWN0X251bWJlcn0gLSB7YWNjb3VudC5uYW1lfScsXG4gIGNvbXBhY3RMYXlvdXQ6IFsnY29udHJhY3RfbnVtYmVyJywgJ2FjY291bnQnLCAnc3RhdHVzJywgJ3N0YXJ0X2RhdGUnLCAnZW5kX2RhdGUnXSxcbiAgXG4gIGZpZWxkczoge1xuICAgIC8vIEF1dG9OdW1iZXIgZmllbGRcbiAgICBjb250cmFjdF9udW1iZXI6IEZpZWxkLmF1dG9udW1iZXIoe1xuICAgICAgbGFiZWw6ICdDb250cmFjdCBOdW1iZXInLFxuICAgICAgZm9ybWF0OiAnQ1RSLXswMDAwfScsXG4gICAgfSksXG4gICAgXG4gICAgLy8gUmVsYXRpb25zaGlwc1xuICAgIGFjY291bnQ6IEZpZWxkLmxvb2t1cCgnYWNjb3VudCcsIHtcbiAgICAgIGxhYmVsOiAnQWNjb3VudCcsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICB9KSxcbiAgICBcbiAgICBjb250YWN0OiBGaWVsZC5sb29rdXAoJ2NvbnRhY3QnLCB7XG4gICAgICBsYWJlbDogJ1ByaW1hcnkgQ29udGFjdCcsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgIHJlZmVyZW5jZUZpbHRlcnM6IFtcbiAgICAgICAgJ2FjY291bnQgPSB7YWNjb3VudH0nLFxuICAgICAgXVxuICAgIH0pLFxuICAgIFxuICAgIG9wcG9ydHVuaXR5OiBGaWVsZC5sb29rdXAoJ29wcG9ydHVuaXR5Jywge1xuICAgICAgbGFiZWw6ICdSZWxhdGVkIE9wcG9ydHVuaXR5JyxcbiAgICAgIHJlZmVyZW5jZUZpbHRlcnM6IFtcbiAgICAgICAgJ2FjY291bnQgPSB7YWNjb3VudH0nLFxuICAgICAgXVxuICAgIH0pLFxuICAgIFxuICAgIG93bmVyOiBGaWVsZC5sb29rdXAoJ3VzZXInLCB7XG4gICAgICBsYWJlbDogJ0NvbnRyYWN0IE93bmVyJyxcbiAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIFN0YXR1c1xuICAgIHN0YXR1czogRmllbGQuc2VsZWN0KHtcbiAgICAgIGxhYmVsOiAnU3RhdHVzJyxcbiAgICAgIG9wdGlvbnM6IFtcbiAgICAgICAgeyBsYWJlbDogJ0RyYWZ0JywgdmFsdWU6ICdkcmFmdCcsIGNvbG9yOiAnIzk5OTk5OScsIGRlZmF1bHQ6IHRydWUgfSxcbiAgICAgICAgeyBsYWJlbDogJ0luIEFwcHJvdmFsJywgdmFsdWU6ICdpbl9hcHByb3ZhbCcsIGNvbG9yOiAnI0ZGQTUwMCcgfSxcbiAgICAgICAgeyBsYWJlbDogJ0FjdGl2YXRlZCcsIHZhbHVlOiAnYWN0aXZhdGVkJywgY29sb3I6ICcjMDBBQTAwJyB9LFxuICAgICAgICB7IGxhYmVsOiAnRXhwaXJlZCcsIHZhbHVlOiAnZXhwaXJlZCcsIGNvbG9yOiAnI0ZGMDAwMCcgfSxcbiAgICAgICAgeyBsYWJlbDogJ1Rlcm1pbmF0ZWQnLCB2YWx1ZTogJ3Rlcm1pbmF0ZWQnLCBjb2xvcjogJyM2NjY2NjYnIH0sXG4gICAgICBdLFxuICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgfSksXG4gICAgXG4gICAgLy8gQ29udHJhY3QgVGVybXNcbiAgICBjb250cmFjdF90ZXJtX21vbnRoczogRmllbGQubnVtYmVyKHtcbiAgICAgIGxhYmVsOiAnQ29udHJhY3QgVGVybSAoTW9udGhzKScsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgIG1pbjogMSxcbiAgICB9KSxcbiAgICBcbiAgICBzdGFydF9kYXRlOiBGaWVsZC5kYXRlKHtcbiAgICAgIGxhYmVsOiAnU3RhcnQgRGF0ZScsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICB9KSxcbiAgICBcbiAgICBlbmRfZGF0ZTogRmllbGQuZGF0ZSh7XG4gICAgICBsYWJlbDogJ0VuZCBEYXRlJyxcbiAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIEZpbmFuY2lhbFxuICAgIGNvbnRyYWN0X3ZhbHVlOiBGaWVsZC5jdXJyZW5jeSh7IFxuICAgICAgbGFiZWw6ICdDb250cmFjdCBWYWx1ZScsXG4gICAgICBzY2FsZTogMixcbiAgICAgIG1pbjogMCxcbiAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIGJpbGxpbmdfZnJlcXVlbmN5OiBGaWVsZC5zZWxlY3Qoe1xuICAgICAgbGFiZWw6ICdCaWxsaW5nIEZyZXF1ZW5jeScsXG4gICAgICBvcHRpb25zOiBbXG4gICAgICAgIHsgbGFiZWw6ICdNb250aGx5JywgdmFsdWU6ICdtb250aGx5JywgZGVmYXVsdDogdHJ1ZSB9LFxuICAgICAgICB7IGxhYmVsOiAnUXVhcnRlcmx5JywgdmFsdWU6ICdxdWFydGVybHknIH0sXG4gICAgICAgIHsgbGFiZWw6ICdBbm51YWxseScsIHZhbHVlOiAnYW5udWFsbHknIH0sXG4gICAgICAgIHsgbGFiZWw6ICdPbmUtdGltZScsIHZhbHVlOiAnb25lX3RpbWUnIH0sXG4gICAgICBdXG4gICAgfSksXG4gICAgXG4gICAgcGF5bWVudF90ZXJtczogRmllbGQuc2VsZWN0KHtcbiAgICAgIGxhYmVsOiAnUGF5bWVudCBUZXJtcycsXG4gICAgICBvcHRpb25zOiBbXG4gICAgICAgIHsgbGFiZWw6ICdOZXQgMTUnLCB2YWx1ZTogJ25ldF8xNScgfSxcbiAgICAgICAgeyBsYWJlbDogJ05ldCAzMCcsIHZhbHVlOiAnbmV0XzMwJywgZGVmYXVsdDogdHJ1ZSB9LFxuICAgICAgICB7IGxhYmVsOiAnTmV0IDYwJywgdmFsdWU6ICduZXRfNjAnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdOZXQgOTAnLCB2YWx1ZTogJ25ldF85MCcgfSxcbiAgICAgIF1cbiAgICB9KSxcbiAgICBcbiAgICAvLyBSZW5ld2FsXG4gICAgYXV0b19yZW5ld2FsOiBGaWVsZC5ib29sZWFuKHtcbiAgICAgIGxhYmVsOiAnQXV0byBSZW5ld2FsJyxcbiAgICAgIGRlZmF1bHRWYWx1ZTogZmFsc2UsXG4gICAgfSksXG4gICAgXG4gICAgcmVuZXdhbF9ub3RpY2VfZGF5czogRmllbGQubnVtYmVyKHtcbiAgICAgIGxhYmVsOiAnUmVuZXdhbCBOb3RpY2UgKERheXMpJyxcbiAgICAgIG1pbjogMCxcbiAgICAgIGRlZmF1bHRWYWx1ZTogMzAsXG4gICAgfSksXG4gICAgXG4gICAgLy8gTGVnYWxcbiAgICBjb250cmFjdF90eXBlOiBGaWVsZC5zZWxlY3Qoe1xuICAgICAgbGFiZWw6ICdDb250cmFjdCBUeXBlJyxcbiAgICAgIG9wdGlvbnM6IFtcbiAgICAgICAgeyBsYWJlbDogJ1N1YnNjcmlwdGlvbicsIHZhbHVlOiAnc3Vic2NyaXB0aW9uJyB9LFxuICAgICAgICB7IGxhYmVsOiAnU2VydmljZSBBZ3JlZW1lbnQnLCB2YWx1ZTogJ3NlcnZpY2UnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdMaWNlbnNlJywgdmFsdWU6ICdsaWNlbnNlJyB9LFxuICAgICAgICB7IGxhYmVsOiAnUGFydG5lcnNoaXAnLCB2YWx1ZTogJ3BhcnRuZXJzaGlwJyB9LFxuICAgICAgICB7IGxhYmVsOiAnTkRBJywgdmFsdWU6ICduZGEnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdNU0EnLCB2YWx1ZTogJ21zYScgfSxcbiAgICAgIF1cbiAgICB9KSxcbiAgICBcbiAgICBzaWduZWRfZGF0ZTogRmllbGQuZGF0ZSh7XG4gICAgICBsYWJlbDogJ1NpZ25lZCBEYXRlJyxcbiAgICB9KSxcbiAgICBcbiAgICBzaWduZWRfYnk6IEZpZWxkLnRleHQoe1xuICAgICAgbGFiZWw6ICdTaWduZWQgQnknLFxuICAgICAgbWF4TGVuZ3RoOiAyNTUsXG4gICAgfSksXG4gICAgXG4gICAgZG9jdW1lbnRfdXJsOiBGaWVsZC51cmwoe1xuICAgICAgbGFiZWw6ICdDb250cmFjdCBEb2N1bWVudCcsXG4gICAgfSksXG4gICAgXG4gICAgLy8gVGVybXMgJiBDb25kaXRpb25zXG4gICAgc3BlY2lhbF90ZXJtczogRmllbGQubWFya2Rvd24oe1xuICAgICAgbGFiZWw6ICdTcGVjaWFsIFRlcm1zJyxcbiAgICB9KSxcbiAgICBcbiAgICBkZXNjcmlwdGlvbjogRmllbGQubWFya2Rvd24oe1xuICAgICAgbGFiZWw6ICdEZXNjcmlwdGlvbicsXG4gICAgfSksXG4gICAgXG4gICAgLy8gQmlsbGluZyBBZGRyZXNzXG4gICAgYmlsbGluZ19hZGRyZXNzOiBGaWVsZC5hZGRyZXNzKHtcbiAgICAgIGxhYmVsOiAnQmlsbGluZyBBZGRyZXNzJyxcbiAgICAgIGFkZHJlc3NGb3JtYXQ6ICdpbnRlcm5hdGlvbmFsJyxcbiAgICB9KSxcbiAgfSxcbiAgXG4gIC8vIERhdGFiYXNlIGluZGV4ZXNcbiAgaW5kZXhlczogW1xuICAgIHsgZmllbGRzOiBbJ2FjY291bnQnXSwgdW5pcXVlOiBmYWxzZSB9LFxuICAgIHsgZmllbGRzOiBbJ3N0YXR1cyddLCB1bmlxdWU6IGZhbHNlIH0sXG4gICAgeyBmaWVsZHM6IFsnc3RhcnRfZGF0ZSddLCB1bmlxdWU6IGZhbHNlIH0sXG4gICAgeyBmaWVsZHM6IFsnZW5kX2RhdGUnXSwgdW5pcXVlOiBmYWxzZSB9LFxuICAgIHsgZmllbGRzOiBbJ293bmVyJ10sIHVuaXF1ZTogZmFsc2UgfSxcbiAgXSxcbiAgXG4gIC8vIEVuYWJsZSBhZHZhbmNlZCBmZWF0dXJlc1xuICBlbmFibGU6IHtcbiAgICB0cmFja0hpc3Rvcnk6IHRydWUsXG4gICAgc2VhcmNoYWJsZTogdHJ1ZSxcbiAgICBhcGlFbmFibGVkOiB0cnVlLFxuICAgIGFwaU1ldGhvZHM6IFsnZ2V0JywgJ2xpc3QnLCAnY3JlYXRlJywgJ3VwZGF0ZScsICdkZWxldGUnLCAnc2VhcmNoJywgJ2V4cG9ydCddLFxuICAgIGZpbGVzOiB0cnVlLFxuICAgIGZlZWRzOiB0cnVlLFxuICAgIGFjdGl2aXRpZXM6IHRydWUsXG4gICAgdHJhc2g6IHRydWUsXG4gICAgbXJ1OiB0cnVlLFxuICB9LFxuICBcbiAgLy8gVmFsaWRhdGlvbiBSdWxlc1xuICB2YWxpZGF0aW9uczogW1xuICAgIHtcbiAgICAgIG5hbWU6ICdlbmRfYWZ0ZXJfc3RhcnQnLFxuICAgICAgdHlwZTogJ3NjcmlwdCcsXG4gICAgICBzZXZlcml0eTogJ2Vycm9yJyxcbiAgICAgIG1lc3NhZ2U6ICdFbmQgRGF0ZSBtdXN0IGJlIGFmdGVyIFN0YXJ0IERhdGUnLFxuICAgICAgY29uZGl0aW9uOiAnZW5kX2RhdGUgPD0gc3RhcnRfZGF0ZScsXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiAndmFsaWRfY29udHJhY3RfdGVybScsXG4gICAgICB0eXBlOiAnc2NyaXB0JyxcbiAgICAgIHNldmVyaXR5OiAnZXJyb3InLFxuICAgICAgbWVzc2FnZTogJ0NvbnRyYWN0IFRlcm0gbXVzdCBtYXRjaCBkYXRlIHJhbmdlJyxcbiAgICAgIGNvbmRpdGlvbjogJ01PTlRIX0RJRkYoZW5kX2RhdGUsIHN0YXJ0X2RhdGUpICE9IGNvbnRyYWN0X3Rlcm1fbW9udGhzJyxcbiAgICB9LFxuICBdLFxuICBcbiAgLy8gV29ya2Zsb3cgUnVsZXNcbiAgd29ya2Zsb3dzOiBbXG4gICAge1xuICAgICAgbmFtZTogJ2NvbnRyYWN0X2V4cGlyYXRpb25fY2hlY2snLFxuICAgICAgb2JqZWN0TmFtZTogJ2NvbnRyYWN0JyxcbiAgICAgIHRyaWdnZXJUeXBlOiAnc2NoZWR1bGVkJyxcbiAgICAgIHNjaGVkdWxlOiAnMCAwICogKiAqJywgLy8gRGFpbHkgYXQgbWlkbmlnaHRcbiAgICAgIGNyaXRlcmlhOiAnZW5kX2RhdGUgPD0gVE9EQVkoKSBBTkQgc3RhdHVzID0gXCJhY3RpdmF0ZWRcIicsXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiAnbWFya19leHBpcmVkJyxcbiAgICAgICAgICB0eXBlOiAnZmllbGRfdXBkYXRlJyxcbiAgICAgICAgICBmaWVsZDogJ3N0YXR1cycsXG4gICAgICAgICAgdmFsdWU6ICdcImV4cGlyZWRcIicsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiAnbm90aWZ5X293bmVyJyxcbiAgICAgICAgICB0eXBlOiAnZW1haWxfYWxlcnQnLFxuICAgICAgICAgIHRlbXBsYXRlOiAnY29udHJhY3RfZXhwaXJlZCcsXG4gICAgICAgICAgcmVjaXBpZW50czogWyd7b3duZXJ9J10sXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgICBhY3RpdmU6IHRydWUsXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiAncmVuZXdhbF9yZW1pbmRlcicsXG4gICAgICBvYmplY3ROYW1lOiAnY29udHJhY3QnLFxuICAgICAgdHJpZ2dlclR5cGU6ICdzY2hlZHVsZWQnLFxuICAgICAgc2NoZWR1bGU6ICcwIDAgKiAqIConLCAvLyBEYWlseSBhdCBtaWRuaWdodFxuICAgICAgY3JpdGVyaWE6ICdEQVlTX1VOVElMKGVuZF9kYXRlKSA8PSByZW5ld2FsX25vdGljZV9kYXlzIEFORCBzdGF0dXMgPSBcImFjdGl2YXRlZFwiJyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICdub3RpZnlfcmVuZXdhbCcsXG4gICAgICAgICAgdHlwZTogJ2VtYWlsX2FsZXJ0JyxcbiAgICAgICAgICB0ZW1wbGF0ZTogJ2NvbnRyYWN0X3JlbmV3YWxfcmVtaW5kZXInLFxuICAgICAgICAgIHJlY2lwaWVudHM6IFsne293bmVyfScsICd7YWNjb3VudC5vd25lcn0nXSxcbiAgICAgICAgfVxuICAgICAgXSxcbiAgICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICB9XG4gIF0sXG59KTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL29iamVjdHMvbGVhZC5vYmplY3QudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvb2JqZWN0c1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9vYmplY3RzL2xlYWQub2JqZWN0LnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5pbXBvcnQgeyBPYmplY3RTY2hlbWEsIEZpZWxkIH0gZnJvbSAnQG9iamVjdHN0YWNrL3NwZWMvZGF0YSc7XG5pbXBvcnQgeyBMZWFkU3RhdGVNYWNoaW5lIH0gZnJvbSAnLi9sZWFkLnN0YXRlJztcblxuZXhwb3J0IGNvbnN0IExlYWQgPSBPYmplY3RTY2hlbWEuY3JlYXRlKHtcbiAgbmFtZTogJ2xlYWQnLFxuICBsYWJlbDogJ0xlYWQnLFxuICBwbHVyYWxMYWJlbDogJ0xlYWRzJyxcbiAgaWNvbjogJ3VzZXItcGx1cycsXG4gIGRlc2NyaXB0aW9uOiAnUG90ZW50aWFsIGN1c3RvbWVycyBub3QgeWV0IHF1YWxpZmllZCcsXG4gIFxuICBmaWVsZHM6IHtcbiAgICAvLyBQZXJzb25hbCBJbmZvcm1hdGlvblxuICAgIHNhbHV0YXRpb246IEZpZWxkLnNlbGVjdChbJ01yLicsICdNcy4nLCAnTXJzLicsICdEci4nXSwge1xuICAgICAgbGFiZWw6ICdTYWx1dGF0aW9uJyxcbiAgICB9KSxcbiAgICBcbiAgICBmaXJzdF9uYW1lOiBGaWVsZC50ZXh0KHtcbiAgICAgIGxhYmVsOiAnRmlyc3QgTmFtZScsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgIHNlYXJjaGFibGU6IHRydWUsXG4gICAgfSksXG4gICAgXG4gICAgbGFzdF9uYW1lOiBGaWVsZC50ZXh0KHtcbiAgICAgIGxhYmVsOiAnTGFzdCBOYW1lJyxcbiAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgc2VhcmNoYWJsZTogdHJ1ZSxcbiAgICB9KSxcbiAgICBcbiAgICBmdWxsX25hbWU6IEZpZWxkLmZvcm11bGEoe1xuICAgICAgbGFiZWw6ICdGdWxsIE5hbWUnLFxuICAgICAgZXhwcmVzc2lvbjogJ0NPTkNBVChzYWx1dGF0aW9uLCBcIiBcIiwgZmlyc3RfbmFtZSwgXCIgXCIsIGxhc3RfbmFtZSknLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIENvbXBhbnkgSW5mb3JtYXRpb25cbiAgICBjb21wYW55OiBGaWVsZC50ZXh0KHtcbiAgICAgIGxhYmVsOiAnQ29tcGFueScsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgIHNlYXJjaGFibGU6IHRydWUsXG4gICAgfSksXG4gICAgXG4gICAgdGl0bGU6IEZpZWxkLnRleHQoe1xuICAgICAgbGFiZWw6ICdKb2IgVGl0bGUnLFxuICAgIH0pLFxuICAgIFxuICAgIGluZHVzdHJ5OiBGaWVsZC5zZWxlY3QoWydUZWNobm9sb2d5JywgJ0ZpbmFuY2UnLCAnSGVhbHRoY2FyZScsICdSZXRhaWwnLCAnTWFudWZhY3R1cmluZycsICdFZHVjYXRpb24nXSwge1xuICAgICAgbGFiZWw6ICdJbmR1c3RyeScsXG4gICAgfSksXG4gICAgXG4gICAgLy8gQ29udGFjdCBJbmZvcm1hdGlvblxuICAgIGVtYWlsOiBGaWVsZC5lbWFpbCh7XG4gICAgICBsYWJlbDogJ0VtYWlsJyxcbiAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgdW5pcXVlOiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIHBob25lOiBGaWVsZC50ZXh0KHtcbiAgICAgIGxhYmVsOiAnUGhvbmUnLFxuICAgICAgZm9ybWF0OiAncGhvbmUnLFxuICAgIH0pLFxuICAgIFxuICAgIG1vYmlsZTogRmllbGQudGV4dCh7XG4gICAgICBsYWJlbDogJ01vYmlsZScsXG4gICAgICBmb3JtYXQ6ICdwaG9uZScsXG4gICAgfSksXG4gICAgXG4gICAgd2Vic2l0ZTogRmllbGQudXJsKHtcbiAgICAgIGxhYmVsOiAnV2Vic2l0ZScsXG4gICAgfSksXG4gICAgXG4gICAgLy8gTGVhZCBRdWFsaWZpY2F0aW9uXG4gICAgc3RhdHVzOiBGaWVsZC5zZWxlY3Qoe1xuICAgICAgbGFiZWw6ICdMZWFkIFN0YXR1cycsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgIG9wdGlvbnM6IFtcbiAgICAgICAgeyBsYWJlbDogJ05ldycsIHZhbHVlOiAnbmV3JywgY29sb3I6ICcjODA4MDgwJywgZGVmYXVsdDogdHJ1ZSB9LFxuICAgICAgICB7IGxhYmVsOiAnQ29udGFjdGVkJywgdmFsdWU6ICdjb250YWN0ZWQnLCBjb2xvcjogJyNGRkE1MDAnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdRdWFsaWZpZWQnLCB2YWx1ZTogJ3F1YWxpZmllZCcsIGNvbG9yOiAnIzQxNjlFMScgfSxcbiAgICAgICAgeyBsYWJlbDogJ1VucXVhbGlmaWVkJywgdmFsdWU6ICd1bnF1YWxpZmllZCcsIGNvbG9yOiAnI0ZGMDAwMCcgfSxcbiAgICAgICAgeyBsYWJlbDogJ0NvbnZlcnRlZCcsIHZhbHVlOiAnY29udmVydGVkJywgY29sb3I6ICcjMDBBQTAwJyB9LFxuICAgICAgXVxuICAgIH0pLFxuICAgIFxuICAgIHJhdGluZzogRmllbGQucmF0aW5nKDUsIHtcbiAgICAgIGxhYmVsOiAnTGVhZCBTY29yZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0xlYWQgcXVhbGl0eSBzY29yZSAoMS01IHN0YXJzKScsXG4gICAgICBhbGxvd0hhbGY6IHRydWUsXG4gICAgfSksXG4gICAgXG4gICAgbGVhZF9zb3VyY2U6IEZpZWxkLnNlbGVjdChbJ1dlYicsICdSZWZlcnJhbCcsICdFdmVudCcsICdQYXJ0bmVyJywgJ0FkdmVydGlzZW1lbnQnLCAnQ29sZCBDYWxsJ10sIHtcbiAgICAgIGxhYmVsOiAnTGVhZCBTb3VyY2UnLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIEFzc2lnbm1lbnRcbiAgICBvd25lcjogRmllbGQubG9va3VwKCd1c2VyJywge1xuICAgICAgbGFiZWw6ICdMZWFkIE93bmVyJyxcbiAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIENvbnZlcnNpb24gdHJhY2tpbmdcbiAgICBpc19jb252ZXJ0ZWQ6IEZpZWxkLmJvb2xlYW4oe1xuICAgICAgbGFiZWw6ICdDb252ZXJ0ZWQnLFxuICAgICAgZGVmYXVsdFZhbHVlOiBmYWxzZSxcbiAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIGNvbnZlcnRlZF9hY2NvdW50OiBGaWVsZC5sb29rdXAoJ2FjY291bnQnLCB7XG4gICAgICBsYWJlbDogJ0NvbnZlcnRlZCBBY2NvdW50JyxcbiAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIGNvbnZlcnRlZF9jb250YWN0OiBGaWVsZC5sb29rdXAoJ2NvbnRhY3QnLCB7XG4gICAgICBsYWJlbDogJ0NvbnZlcnRlZCBDb250YWN0JyxcbiAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIGNvbnZlcnRlZF9vcHBvcnR1bml0eTogRmllbGQubG9va3VwKCdvcHBvcnR1bml0eScsIHtcbiAgICAgIGxhYmVsOiAnQ29udmVydGVkIE9wcG9ydHVuaXR5JyxcbiAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIGNvbnZlcnRlZF9kYXRlOiBGaWVsZC5kYXRldGltZSh7XG4gICAgICBsYWJlbDogJ0NvbnZlcnRlZCBEYXRlJyxcbiAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIEFkZHJlc3MgKHVzaW5nIG5ldyBhZGRyZXNzIGZpZWxkIHR5cGUpXG4gICAgYWRkcmVzczogRmllbGQuYWRkcmVzcyh7XG4gICAgICBsYWJlbDogJ0FkZHJlc3MnLFxuICAgICAgYWRkcmVzc0Zvcm1hdDogJ2ludGVybmF0aW9uYWwnLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIEFkZGl0aW9uYWwgSW5mb1xuICAgIGFubnVhbF9yZXZlbnVlOiBGaWVsZC5jdXJyZW5jeSh7XG4gICAgICBsYWJlbDogJ0FubnVhbCBSZXZlbnVlJyxcbiAgICAgIHNjYWxlOiAyLFxuICAgIH0pLFxuICAgIFxuICAgIG51bWJlcl9vZl9lbXBsb3llZXM6IEZpZWxkLm51bWJlcih7XG4gICAgICBsYWJlbDogJ051bWJlciBvZiBFbXBsb3llZXMnLFxuICAgIH0pLFxuICAgIFxuICAgIGRlc2NyaXB0aW9uOiBGaWVsZC5tYXJrZG93bih7XG4gICAgICBsYWJlbDogJ0Rlc2NyaXB0aW9uJyxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBDdXN0b20gbm90ZXMgd2l0aCByaWNoIHRleHQgZm9ybWF0dGluZ1xuICAgIG5vdGVzOiBGaWVsZC5yaWNodGV4dCh7XG4gICAgICBsYWJlbDogJ05vdGVzJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUmljaCB0ZXh0IG5vdGVzIHdpdGggZm9ybWF0dGluZycsXG4gICAgfSksXG4gICAgXG4gICAgLy8gRmxhZ3NcbiAgICBkb19ub3RfY2FsbDogRmllbGQuYm9vbGVhbih7XG4gICAgICBsYWJlbDogJ0RvIE5vdCBDYWxsJyxcbiAgICAgIGRlZmF1bHRWYWx1ZTogZmFsc2UsXG4gICAgfSksXG4gICAgXG4gICAgZW1haWxfb3B0X291dDogRmllbGQuYm9vbGVhbih7XG4gICAgICBsYWJlbDogJ0VtYWlsIE9wdCBPdXQnLFxuICAgICAgZGVmYXVsdFZhbHVlOiBmYWxzZSxcbiAgICB9KSxcbiAgfSxcblxuICAvLyBMaWZlY3ljbGUgU3RhdGUgTWFjaGluZShzKVxuICAvLyBFbmZvcmNlcyB2YWxpZCBzdGF0dXMgdHJhbnNpdGlvbnMgdG8gcHJldmVudCBBSSBoYWxsdWNpbmF0aW9uc1xuICAvLyBVc2luZyBgc3RhdGVNYWNoaW5lc2AgKHBsdXJhbCkgZm9yIGZ1dHVyZSBleHRlbnNpYmlsaXR5LlxuICAvLyBGb3Igc2ltcGxlIG9iamVjdHMgd2l0aCBvbmUgbGlmZWN5Y2xlLCBgc3RhdGVNYWNoaW5lYCAoc2luZ3VsYXIpIGlzIGFsc28gc3VwcG9ydGVkLlxuICBzdGF0ZU1hY2hpbmVzOiB7XG4gICAgbGlmZWN5Y2xlOiBMZWFkU3RhdGVNYWNoaW5lLFxuICB9LFxuICBcbiAgLy8gRGF0YWJhc2UgaW5kZXhlcyBmb3IgcGVyZm9ybWFuY2VcbiAgaW5kZXhlczogW1xuICAgIHsgZmllbGRzOiBbJ2VtYWlsJ10sIHVuaXF1ZTogdHJ1ZSB9LFxuICAgIHsgZmllbGRzOiBbJ293bmVyJ10sIHVuaXF1ZTogZmFsc2UgfSxcbiAgICB7IGZpZWxkczogWydzdGF0dXMnXSwgdW5pcXVlOiBmYWxzZSB9LFxuICAgIHsgZmllbGRzOiBbJ2NvbXBhbnknXSwgdW5pcXVlOiBmYWxzZSB9LFxuICBdLFxuICBcbiAgZW5hYmxlOiB7XG4gICAgdHJhY2tIaXN0b3J5OiB0cnVlLFxuICAgIHNlYXJjaGFibGU6IHRydWUsXG4gICAgYXBpRW5hYmxlZDogdHJ1ZSxcbiAgICBmaWxlczogdHJ1ZSxcbiAgICBmZWVkczogdHJ1ZSwgICAgICAgICAgICAvLyBFbmFibGUgc29jaWFsIGZlZWQsIGNvbW1lbnRzLCBhbmQgbWVudGlvbnNcbiAgICBhY3Rpdml0aWVzOiB0cnVlLCAgICAgICAvLyBFbmFibGUgdGFza3MgYW5kIGV2ZW50cyB0cmFja2luZ1xuICAgIHRyYXNoOiB0cnVlLFxuICAgIG1ydTogdHJ1ZSwgICAgICAgICAgICAgIC8vIFRyYWNrIE1vc3QgUmVjZW50bHkgVXNlZFxuICB9LFxuICBcbiAgdGl0bGVGb3JtYXQ6ICd7ZnVsbF9uYW1lfSAtIHtjb21wYW55fScsXG4gIGNvbXBhY3RMYXlvdXQ6IFsnZnVsbF9uYW1lJywgJ2NvbXBhbnknLCAnZW1haWwnLCAnc3RhdHVzJywgJ293bmVyJ10sXG4gIFxuICAvLyBSZW1vdmVkOiBsaXN0X3ZpZXdzIGFuZCBmb3JtX3ZpZXdzIGJlbG9uZyBpbiBVSSBjb25maWd1cmF0aW9uLCBub3Qgb2JqZWN0IGRlZmluaXRpb25cbiAgXG4gIHZhbGlkYXRpb25zOiBbXG4gICAge1xuICAgICAgbmFtZTogJ2VtYWlsX3JlcXVpcmVkJyxcbiAgICAgIHR5cGU6ICdzY3JpcHQnLFxuICAgICAgc2V2ZXJpdHk6ICdlcnJvcicsXG4gICAgICBtZXNzYWdlOiAnRW1haWwgaXMgcmVxdWlyZWQnLFxuICAgICAgY29uZGl0aW9uOiAnSVNCTEFOSyhlbWFpbCknLFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJ2Nhbm5vdF9lZGl0X2NvbnZlcnRlZCcsXG4gICAgICB0eXBlOiAnc2NyaXB0JyxcbiAgICAgIHNldmVyaXR5OiAnZXJyb3InLFxuICAgICAgbWVzc2FnZTogJ0Nhbm5vdCBlZGl0IGEgY29udmVydGVkIGxlYWQnLFxuICAgICAgY29uZGl0aW9uOiAnaXNfY29udmVydGVkID0gdHJ1ZSBBTkQgSVNDSEFOR0VEKGNvbXBhbnksIGVtYWlsLCBmaXJzdF9uYW1lLCBsYXN0X25hbWUpJyxcbiAgICB9LFxuICBdLFxuICBcbiAgd29ya2Zsb3dzOiBbXG4gICAge1xuICAgICAgbmFtZTogJ2F1dG9fcXVhbGlmeV9oaWdoX3Njb3JlX2xlYWRzJyxcbiAgICAgIG9iamVjdE5hbWU6ICdsZWFkJyxcbiAgICAgIHRyaWdnZXJUeXBlOiAnb25fY3JlYXRlX29yX3VwZGF0ZScsXG4gICAgICBjcml0ZXJpYTogJ3JhdGluZyA+PSA0IEFORCBzdGF0dXMgPSBcIm5ld1wiJyxcbiAgICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICdzZXRfc3RhdHVzJyxcbiAgICAgICAgICB0eXBlOiAnZmllbGRfdXBkYXRlJyxcbiAgICAgICAgICBmaWVsZDogJ3N0YXR1cycsXG4gICAgICAgICAgdmFsdWU6ICdjb250YWN0ZWQnLFxuICAgICAgICB9XG4gICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJ25vdGlmeV9vd25lcl9vbl9oaWdoX3Njb3JlX2xlYWQnLFxuICAgICAgb2JqZWN0TmFtZTogJ2xlYWQnLFxuICAgICAgdHJpZ2dlclR5cGU6ICdvbl9jcmVhdGVfb3JfdXBkYXRlJyxcbiAgICAgIGNyaXRlcmlhOiAnSVNDSEFOR0VEKHJhdGluZykgQU5EIHJhdGluZyA+PSA0LjUnLFxuICAgICAgYWN0aXZlOiB0cnVlLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogJ2VtYWlsX293bmVyJyxcbiAgICAgICAgICB0eXBlOiAnZW1haWxfYWxlcnQnLFxuICAgICAgICAgIHRlbXBsYXRlOiAnaGlnaF9zY29yZV9sZWFkX25vdGlmaWNhdGlvbicsXG4gICAgICAgICAgcmVjaXBpZW50czogWyd7b3duZXIuZW1haWx9J10sXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgfVxuICBdLFxufSk7XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9vYmplY3RzL2xlYWQuc3RhdGUudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvb2JqZWN0c1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9vYmplY3RzL2xlYWQuc3RhdGUudHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbmltcG9ydCB7IFN0YXRlTWFjaGluZUNvbmZpZyB9IGZyb20gJ0BvYmplY3RzdGFjay9zcGVjL2F1dG9tYXRpb24nO1xuXG4vKipcbiAqIExlYWQgTGlmZWN5Y2xlIFN0YXRlIE1hY2hpbmVcbiAqIFxuICogRGVmaW5lcyB0aGUgc3RyaWN0IHN0YXR1cyB0cmFuc2l0aW9ucyBmb3IgTGVhZHMgdG8gcHJldmVudCBpbnZhbGlkIG9wZXJhdGlvbnNcbiAqIGFuZCBndWlkZSBBSSBhZ2VudHMuXG4gKi9cbmV4cG9ydCBjb25zdCBMZWFkU3RhdGVNYWNoaW5lOiBTdGF0ZU1hY2hpbmVDb25maWcgPSB7XG4gIGlkOiAnbGVhZF9wcm9jZXNzJyxcbiAgaW5pdGlhbDogJ25ldycsXG4gIHN0YXRlczoge1xuICAgIG5ldzoge1xuICAgICAgb246IHtcbiAgICAgICAgQ09OVEFDVDogeyB0YXJnZXQ6ICdjb250YWN0ZWQnLCBkZXNjcmlwdGlvbjogJ0xvZyBpbml0aWFsIGNvbnRhY3QnIH0sXG4gICAgICAgIERJU1FVQUxJRlk6IHsgdGFyZ2V0OiAndW5xdWFsaWZpZWQnLCBkZXNjcmlwdGlvbjogJ01hcmsgYXMgdW5xdWFsaWZpZWQgZWFybHknIH1cbiAgICAgIH0sXG4gICAgICBtZXRhOiB7XG4gICAgICAgIGFpSW5zdHJ1Y3Rpb25zOiAnTmV3IGxlYWQuIFZlcmlmeSBlbWFpbCBhbmQgcGhvbmUgYmVmb3JlIGNvbnRhY3RpbmcuIERvIG5vdCBjaGFuZ2Ugc3RhdHVzIHVudGlsIGNvbnRhY3QgaXMgbWFkZS4nXG4gICAgICB9XG4gICAgfSxcbiAgICBjb250YWN0ZWQ6IHtcbiAgICAgIG9uOiB7XG4gICAgICAgIFFVQUxJRlk6IHsgdGFyZ2V0OiAncXVhbGlmaWVkJywgY29uZDogJ2hhc19idWRnZXRfYW5kX2F1dGhvcml0eScgfSxcbiAgICAgICAgRElTUVVBTElGWTogeyB0YXJnZXQ6ICd1bnF1YWxpZmllZCcgfVxuICAgICAgfSxcbiAgICAgIG1ldGE6IHtcbiAgICAgICAgYWlJbnN0cnVjdGlvbnM6ICdFbmdhZ2Ugd2l0aCB0aGUgbGVhZC4gUXVhbGlmeSBieSBhc2tpbmcgYWJvdXQgYnVkZ2V0LCBhdXRob3JpdHksIG5lZWQsIGFuZCB0aW1lbGluZSAoQkFOVCkuJ1xuICAgICAgfVxuICAgIH0sXG4gICAgcXVhbGlmaWVkOiB7XG4gICAgICBvbjoge1xuICAgICAgICBDT05WRVJUOiB7IHRhcmdldDogJ2NvbnZlcnRlZCcsIGNvbmQ6ICdpc19yZWFkeV90b19idXknIH0sXG4gICAgICAgIERJU1FVQUxJRlk6IHsgdGFyZ2V0OiAndW5xdWFsaWZpZWQnIH1cbiAgICAgIH0sXG4gICAgICBtZXRhOiB7XG4gICAgICAgIGFpSW5zdHJ1Y3Rpb25zOiAnTGVhZCBpcyBxdWFsaWZpZWQuIFByZXBhcmUgZm9yIGNvbnZlcnNpb24gdG8gRGVhbC9PcHBvcnR1bml0eS4gQ2hlY2sgZm9yIGV4aXN0aW5nIGFjY291bnRzLidcbiAgICAgIH1cbiAgICB9LFxuICAgIHVucXVhbGlmaWVkOiB7XG4gICAgICBvbjoge1xuICAgICAgICBSRU9QRU46IHsgdGFyZ2V0OiAnbmV3JywgZGVzY3JpcHRpb246ICdSZS1ldmFsdWF0ZSBsZWFkJyB9XG4gICAgICB9LFxuICAgICAgbWV0YToge1xuICAgICAgICBhaUluc3RydWN0aW9uczogJ0xlYWQgaXMgZGVhZC4gRG8gbm90IGNvbnRhY3QgdW5sZXNzIG5ldyBpbmZvcm1hdGlvbiBzdXJmYWNlcy4nXG4gICAgICB9XG4gICAgfSxcbiAgICBjb252ZXJ0ZWQ6IHtcbiAgICAgIHR5cGU6ICdmaW5hbCcsXG4gICAgICBtZXRhOiB7XG4gICAgICAgIGFpSW5zdHJ1Y3Rpb25zOiAnTGVhZCBpcyBjb252ZXJ0ZWQuIE5vIGZ1cnRoZXIgYWN0aW9ucyBhbGxvd2VkIG9uIHRoaXMgcmVjb3JkLidcbiAgICAgIH1cbiAgICB9XG4gIH1cbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9vYmplY3RzL29wcG9ydHVuaXR5Lm9iamVjdC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9vYmplY3RzXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL29iamVjdHMvb3Bwb3J0dW5pdHkub2JqZWN0LnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5pbXBvcnQgeyBPYmplY3RTY2hlbWEsIEZpZWxkIH0gZnJvbSAnQG9iamVjdHN0YWNrL3NwZWMvZGF0YSc7XG5cbmV4cG9ydCBjb25zdCBPcHBvcnR1bml0eSA9IE9iamVjdFNjaGVtYS5jcmVhdGUoe1xuICBuYW1lOiAnb3Bwb3J0dW5pdHknLFxuICBsYWJlbDogJ09wcG9ydHVuaXR5JyxcbiAgcGx1cmFsTGFiZWw6ICdPcHBvcnR1bml0aWVzJyxcbiAgaWNvbjogJ2RvbGxhci1zaWduJyxcbiAgZGVzY3JpcHRpb246ICdTYWxlcyBvcHBvcnR1bml0aWVzIGFuZCBkZWFscyBpbiB0aGUgcGlwZWxpbmUnLFxuICB0aXRsZUZvcm1hdDogJ3tuYW1lfSAtIHtzdGFnZX0nLFxuICBjb21wYWN0TGF5b3V0OiBbJ25hbWUnLCAnYWNjb3VudCcsICdhbW91bnQnLCAnc3RhZ2UnLCAnb3duZXInXSxcbiAgXG4gIGZpZWxkczoge1xuICAgIC8vIEJhc2ljIEluZm9ybWF0aW9uXG4gICAgbmFtZTogRmllbGQudGV4dCh7IFxuICAgICAgbGFiZWw6ICdPcHBvcnR1bml0eSBOYW1lJyxcbiAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgc2VhcmNoYWJsZTogdHJ1ZSxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBSZWxhdGlvbnNoaXBzXG4gICAgYWNjb3VudDogRmllbGQubG9va3VwKCdhY2NvdW50JywgeyBcbiAgICAgIGxhYmVsOiAnQWNjb3VudCcsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICB9KSxcbiAgICBcbiAgICBwcmltYXJ5X2NvbnRhY3Q6IEZpZWxkLmxvb2t1cCgnY29udGFjdCcsIHtcbiAgICAgIGxhYmVsOiAnUHJpbWFyeSBDb250YWN0JyxcbiAgICAgIHJlZmVyZW5jZUZpbHRlcnM6IFsnYWNjb3VudCA9IHtvcHBvcnR1bml0eS5hY2NvdW50fSddLCAgLy8gRmlsdGVyIGNvbnRhY3RzIGJ5IGFjY291bnRcbiAgICB9KSxcbiAgICBcbiAgICBvd25lcjogRmllbGQubG9va3VwKCd1c2VyJywge1xuICAgICAgbGFiZWw6ICdPcHBvcnR1bml0eSBPd25lcicsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBGaW5hbmNpYWwgSW5mb3JtYXRpb25cbiAgICBhbW91bnQ6IEZpZWxkLmN1cnJlbmN5KHtcbiAgICAgIGxhYmVsOiAnQW1vdW50JyxcbiAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgc2NhbGU6IDIsXG4gICAgICBtaW46IDAsXG4gICAgfSksXG4gICAgXG4gICAgZXhwZWN0ZWRfcmV2ZW51ZTogRmllbGQuY3VycmVuY3koe1xuICAgICAgbGFiZWw6ICdFeHBlY3RlZCBSZXZlbnVlJyxcbiAgICAgIHNjYWxlOiAyLFxuICAgICAgcmVhZG9ubHk6IHRydWUsICAvLyBDYWxjdWxhdGVkIGZpZWxkXG4gICAgfSksXG4gICAgXG4gICAgLy8gU2FsZXMgUHJvY2Vzc1xuICAgIHN0YWdlOiBGaWVsZC5zZWxlY3Qoe1xuICAgICAgbGFiZWw6ICdTdGFnZScsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgIG9wdGlvbnM6IFtcbiAgICAgICAgeyBsYWJlbDogJ1Byb3NwZWN0aW5nJywgdmFsdWU6ICdwcm9zcGVjdGluZycsIGNvbG9yOiAnIzgwODA4MCcsIGRlZmF1bHQ6IHRydWUgfSxcbiAgICAgICAgeyBsYWJlbDogJ1F1YWxpZmljYXRpb24nLCB2YWx1ZTogJ3F1YWxpZmljYXRpb24nLCBjb2xvcjogJyNGRkE1MDAnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdOZWVkcyBBbmFseXNpcycsIHZhbHVlOiAnbmVlZHNfYW5hbHlzaXMnLCBjb2xvcjogJyNGRkQ3MDAnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdQcm9wb3NhbCcsIHZhbHVlOiAncHJvcG9zYWwnLCBjb2xvcjogJyM0MTY5RTEnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdOZWdvdGlhdGlvbicsIHZhbHVlOiAnbmVnb3RpYXRpb24nLCBjb2xvcjogJyM5MzcwREInIH0sXG4gICAgICAgIHsgbGFiZWw6ICdDbG9zZWQgV29uJywgdmFsdWU6ICdjbG9zZWRfd29uJywgY29sb3I6ICcjMDBBQTAwJyB9LFxuICAgICAgICB7IGxhYmVsOiAnQ2xvc2VkIExvc3QnLCB2YWx1ZTogJ2Nsb3NlZF9sb3N0JywgY29sb3I6ICcjRkYwMDAwJyB9LFxuICAgICAgXVxuICAgIH0pLFxuICAgIFxuICAgIHByb2JhYmlsaXR5OiBGaWVsZC5wZXJjZW50KHtcbiAgICAgIGxhYmVsOiAnUHJvYmFiaWxpdHkgKCUpJyxcbiAgICAgIG1pbjogMCxcbiAgICAgIG1heDogMTAwLFxuICAgICAgZGVmYXVsdFZhbHVlOiAxMCxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBJbXBvcnRhbnQgRGF0ZXNcbiAgICBjbG9zZV9kYXRlOiBGaWVsZC5kYXRlKHtcbiAgICAgIGxhYmVsOiAnQ2xvc2UgRGF0ZScsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICB9KSxcbiAgICBcbiAgICBjcmVhdGVkX2RhdGU6IEZpZWxkLmRhdGV0aW1lKHtcbiAgICAgIGxhYmVsOiAnQ3JlYXRlZCBEYXRlJyxcbiAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIEFkZGl0aW9uYWwgQ2xhc3NpZmljYXRpb25cbiAgICB0eXBlOiBGaWVsZC5zZWxlY3QoWydOZXcgQnVzaW5lc3MnLCAnRXhpc3RpbmcgQ3VzdG9tZXIgLSBVcGdyYWRlJywgJ0V4aXN0aW5nIEN1c3RvbWVyIC0gUmVuZXdhbCcsICdFeGlzdGluZyBDdXN0b21lciAtIEV4cGFuc2lvbiddLCB7XG4gICAgICBsYWJlbDogJ09wcG9ydHVuaXR5IFR5cGUnLFxuICAgIH0pLFxuICAgIFxuICAgIGxlYWRfc291cmNlOiBGaWVsZC5zZWxlY3QoWydXZWInLCAnUmVmZXJyYWwnLCAnRXZlbnQnLCAnUGFydG5lcicsICdBZHZlcnRpc2VtZW50JywgJ0NvbGQgQ2FsbCddLCB7XG4gICAgICBsYWJlbDogJ0xlYWQgU291cmNlJyxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBDb21wZXRpdG9yIEFuYWx5c2lzXG4gICAgY29tcGV0aXRvcnM6IEZpZWxkLnNlbGVjdChbJ0NvbXBldGl0b3IgQScsICdDb21wZXRpdG9yIEInLCAnQ29tcGV0aXRvciBDJ10sIHtcbiAgICAgIGxhYmVsOiAnQ29tcGV0aXRvcnMnLFxuICAgICAgbXVsdGlwbGU6IHRydWUsXG4gICAgfSksXG4gICAgXG4gICAgLy8gQ2FtcGFpZ24gdHJhY2tpbmdcbiAgICBjYW1wYWlnbjogRmllbGQubG9va3VwKCdjYW1wYWlnbicsIHtcbiAgICAgIGxhYmVsOiAnQ2FtcGFpZ24nLFxuICAgICAgZGVzY3JpcHRpb246ICdNYXJrZXRpbmcgY2FtcGFpZ24gdGhhdCBnZW5lcmF0ZWQgdGhpcyBvcHBvcnR1bml0eScsXG4gICAgfSksXG4gICAgXG4gICAgLy8gU2FsZXMgY3ljbGUgbWV0cmljc1xuICAgIGRheXNfaW5fc3RhZ2U6IEZpZWxkLm51bWJlcih7XG4gICAgICBsYWJlbDogJ0RheXMgaW4gQ3VycmVudCBTdGFnZScsXG4gICAgICByZWFkb25seTogdHJ1ZSxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBBZGRpdGlvbmFsIGluZm9ybWF0aW9uXG4gICAgZGVzY3JpcHRpb246IEZpZWxkLm1hcmtkb3duKHtcbiAgICAgIGxhYmVsOiAnRGVzY3JpcHRpb24nLFxuICAgIH0pLFxuICAgIFxuICAgIG5leHRfc3RlcDogRmllbGQudGV4dGFyZWEoe1xuICAgICAgbGFiZWw6ICdOZXh0IFN0ZXBzJyxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBGbGFnc1xuICAgIGlzX3ByaXZhdGU6IEZpZWxkLmJvb2xlYW4oe1xuICAgICAgbGFiZWw6ICdQcml2YXRlJyxcbiAgICAgIGRlZmF1bHRWYWx1ZTogZmFsc2UsXG4gICAgfSksXG4gICAgXG4gICAgZm9yZWNhc3RfY2F0ZWdvcnk6IEZpZWxkLnNlbGVjdChbJ1BpcGVsaW5lJywgJ0Jlc3QgQ2FzZScsICdDb21taXQnLCAnT21pdHRlZCcsICdDbG9zZWQnXSwge1xuICAgICAgbGFiZWw6ICdGb3JlY2FzdCBDYXRlZ29yeScsXG4gICAgfSksXG4gIH0sXG4gIFxuICAvLyBEYXRhYmFzZSBpbmRleGVzIGZvciBwZXJmb3JtYW5jZVxuICBpbmRleGVzOiBbXG4gICAgeyBmaWVsZHM6IFsnbmFtZSddLCB1bmlxdWU6IGZhbHNlIH0sXG4gICAgeyBmaWVsZHM6IFsnYWNjb3VudCddLCB1bmlxdWU6IGZhbHNlIH0sXG4gICAgeyBmaWVsZHM6IFsnb3duZXInXSwgdW5pcXVlOiBmYWxzZSB9LFxuICAgIHsgZmllbGRzOiBbJ3N0YWdlJ10sIHVuaXF1ZTogZmFsc2UgfSxcbiAgICB7IGZpZWxkczogWydjbG9zZV9kYXRlJ10sIHVuaXF1ZTogZmFsc2UgfSxcbiAgXSxcbiAgXG4gIC8vIEVuYWJsZSBhZHZhbmNlZCBmZWF0dXJlc1xuICBlbmFibGU6IHtcbiAgICB0cmFja0hpc3Rvcnk6IHRydWUsICAgIC8vIENyaXRpY2FsIGZvciB0cmFja2luZyBzdGFnZSBjaGFuZ2VzXG4gICAgc2VhcmNoYWJsZTogdHJ1ZSxcbiAgICBhcGlFbmFibGVkOiB0cnVlLFxuICAgIGFwaU1ldGhvZHM6IFsnZ2V0JywgJ2xpc3QnLCAnY3JlYXRlJywgJ3VwZGF0ZScsICdkZWxldGUnLCAnYWdncmVnYXRlJywgJ3NlYXJjaCddLCAvLyBXaGl0ZWxpc3QgYWxsb3dlZCBBUEkgb3BlcmF0aW9uc1xuICAgIGZpbGVzOiB0cnVlLCAgICAgICAgICAgLy8gQXR0YWNoIHByb3Bvc2FscywgY29udHJhY3RzXG4gICAgZmVlZHM6IHRydWUsICAgICAgICAgICAvLyBUZWFtIGNvbGxhYm9yYXRpb24gKENoYXR0ZXItbGlrZSlcbiAgICBhY3Rpdml0aWVzOiB0cnVlLCAgICAgIC8vIEVuYWJsZSB0YXNrcyBhbmQgZXZlbnRzIHRyYWNraW5nXG4gICAgdHJhc2g6IHRydWUsXG4gICAgbXJ1OiB0cnVlLCAgICAgICAgICAgICAvLyBUcmFjayBNb3N0IFJlY2VudGx5IFVzZWRcbiAgfSxcbiAgXG4gIC8vIFJlbW92ZWQ6IGxpc3Rfdmlld3MgYW5kIGZvcm1fdmlld3MgYmVsb25nIGluIFVJIGNvbmZpZ3VyYXRpb24sIG5vdCBvYmplY3QgZGVmaW5pdGlvblxuICBcbiAgLy8gVmFsaWRhdGlvbiBSdWxlc1xuICB2YWxpZGF0aW9uczogW1xuICAgIHtcbiAgICAgIG5hbWU6ICdjbG9zZV9kYXRlX2Z1dHVyZScsXG4gICAgICB0eXBlOiAnc2NyaXB0JyxcbiAgICAgIHNldmVyaXR5OiAnd2FybmluZycsXG4gICAgICBtZXNzYWdlOiAnQ2xvc2UgZGF0ZSBzaG91bGQgbm90IGJlIGluIHRoZSBwYXN0IHVubGVzcyBvcHBvcnR1bml0eSBpcyBjbG9zZWQnLFxuICAgICAgY29uZGl0aW9uOiAnY2xvc2VfZGF0ZSA8IFRPREFZKCkgQU5EIHN0YWdlICE9IFwiY2xvc2VkX3dvblwiIEFORCBzdGFnZSAhPSBcImNsb3NlZF9sb3N0XCInLFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJ2Ftb3VudF9wb3NpdGl2ZScsXG4gICAgICB0eXBlOiAnc2NyaXB0JyxcbiAgICAgIHNldmVyaXR5OiAnZXJyb3InLFxuICAgICAgbWVzc2FnZTogJ0Ftb3VudCBtdXN0IGJlIGdyZWF0ZXIgdGhhbiB6ZXJvJyxcbiAgICAgIGNvbmRpdGlvbjogJ2Ftb3VudCA8PSAwJyxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICdzdGFnZV9wcm9ncmVzc2lvbicsXG4gICAgICB0eXBlOiAnc3RhdGVfbWFjaGluZScsXG4gICAgICBzZXZlcml0eTogJ2Vycm9yJyxcbiAgICAgIG1lc3NhZ2U6ICdJbnZhbGlkIHN0YWdlIHRyYW5zaXRpb24nLFxuICAgICAgZmllbGQ6ICdzdGFnZScsXG4gICAgICB0cmFuc2l0aW9uczoge1xuICAgICAgICAncHJvc3BlY3RpbmcnOiBbJ3F1YWxpZmljYXRpb24nLCAnY2xvc2VkX2xvc3QnXSxcbiAgICAgICAgJ3F1YWxpZmljYXRpb24nOiBbJ25lZWRzX2FuYWx5c2lzJywgJ2Nsb3NlZF9sb3N0J10sXG4gICAgICAgICduZWVkc19hbmFseXNpcyc6IFsncHJvcG9zYWwnLCAnY2xvc2VkX2xvc3QnXSxcbiAgICAgICAgJ3Byb3Bvc2FsJzogWyduZWdvdGlhdGlvbicsICdjbG9zZWRfbG9zdCddLFxuICAgICAgICAnbmVnb3RpYXRpb24nOiBbJ2Nsb3NlZF93b24nLCAnY2xvc2VkX2xvc3QnXSxcbiAgICAgICAgJ2Nsb3NlZF93b24nOiBbXSwgIC8vIFRlcm1pbmFsIHN0YXRlXG4gICAgICAgICdjbG9zZWRfbG9zdCc6IFtdICAvLyBUZXJtaW5hbCBzdGF0ZVxuICAgICAgfVxuICAgIH0sXG4gIF0sXG4gIFxuICAvLyBXb3JrZmxvdyBSdWxlc1xuICB3b3JrZmxvd3M6IFtcbiAgICB7XG4gICAgICBuYW1lOiAndXBkYXRlX3Byb2JhYmlsaXR5X2J5X3N0YWdlJyxcbiAgICAgIG9iamVjdE5hbWU6ICdvcHBvcnR1bml0eScsXG4gICAgICB0cmlnZ2VyVHlwZTogJ29uX2NyZWF0ZV9vcl91cGRhdGUnLFxuICAgICAgY3JpdGVyaWE6ICdJU0NIQU5HRUQoc3RhZ2UpJyxcbiAgICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICdzZXRfcHJvYmFiaWxpdHknLFxuICAgICAgICAgIHR5cGU6ICdmaWVsZF91cGRhdGUnLFxuICAgICAgICAgIGZpZWxkOiAncHJvYmFiaWxpdHknLFxuICAgICAgICAgIHZhbHVlOiBgQ0FTRShzdGFnZSxcbiAgICAgICAgICAgIFwicHJvc3BlY3RpbmdcIiwgMTAsXG4gICAgICAgICAgICBcInF1YWxpZmljYXRpb25cIiwgMjUsXG4gICAgICAgICAgICBcIm5lZWRzX2FuYWx5c2lzXCIsIDQwLFxuICAgICAgICAgICAgXCJwcm9wb3NhbFwiLCA2MCxcbiAgICAgICAgICAgIFwibmVnb3RpYXRpb25cIiwgODAsXG4gICAgICAgICAgICBcImNsb3NlZF93b25cIiwgMTAwLFxuICAgICAgICAgICAgXCJjbG9zZWRfbG9zdFwiLCAwLFxuICAgICAgICAgICAgcHJvYmFiaWxpdHlcbiAgICAgICAgICApYCxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICdzZXRfZm9yZWNhc3RfY2F0ZWdvcnknLFxuICAgICAgICAgIHR5cGU6ICdmaWVsZF91cGRhdGUnLFxuICAgICAgICAgIGZpZWxkOiAnZm9yZWNhc3RfY2F0ZWdvcnknLFxuICAgICAgICAgIHZhbHVlOiBgQ0FTRShzdGFnZSxcbiAgICAgICAgICAgIFwicHJvc3BlY3RpbmdcIiwgXCJwaXBlbGluZVwiLFxuICAgICAgICAgICAgXCJxdWFsaWZpY2F0aW9uXCIsIFwicGlwZWxpbmVcIixcbiAgICAgICAgICAgIFwibmVlZHNfYW5hbHlzaXNcIiwgXCJiZXN0X2Nhc2VcIixcbiAgICAgICAgICAgIFwicHJvcG9zYWxcIiwgXCJjb21taXRcIixcbiAgICAgICAgICAgIFwibmVnb3RpYXRpb25cIiwgXCJjb21taXRcIixcbiAgICAgICAgICAgIFwiY2xvc2VkX3dvblwiLCBcImNsb3NlZFwiLFxuICAgICAgICAgICAgXCJjbG9zZWRfbG9zdFwiLCBcIm9taXR0ZWRcIixcbiAgICAgICAgICAgIGZvcmVjYXN0X2NhdGVnb3J5XG4gICAgICAgICAgKWAsXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiAnY2FsY3VsYXRlX2V4cGVjdGVkX3JldmVudWUnLFxuICAgICAgb2JqZWN0TmFtZTogJ29wcG9ydHVuaXR5JyxcbiAgICAgIHRyaWdnZXJUeXBlOiAnb25fY3JlYXRlX29yX3VwZGF0ZScsXG4gICAgICBjcml0ZXJpYTogJ0lTQ0hBTkdFRChhbW91bnQpIE9SIElTQ0hBTkdFRChwcm9iYWJpbGl0eSknLFxuICAgICAgYWN0aXZlOiB0cnVlLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogJ3VwZGF0ZV9leHBlY3RlZF9yZXZlbnVlJyxcbiAgICAgICAgICB0eXBlOiAnZmllbGRfdXBkYXRlJyxcbiAgICAgICAgICBmaWVsZDogJ2V4cGVjdGVkX3JldmVudWUnLFxuICAgICAgICAgIHZhbHVlOiAnYW1vdW50ICogKHByb2JhYmlsaXR5IC8gMTAwKScsXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiAnbm90aWZ5X29uX2xhcmdlX2RlYWxfd29uJyxcbiAgICAgIG9iamVjdE5hbWU6ICdvcHBvcnR1bml0eScsXG4gICAgICB0cmlnZ2VyVHlwZTogJ29uX3VwZGF0ZScsXG4gICAgICBjcml0ZXJpYTogJ0lTQ0hBTkdFRChzdGFnZSkgQU5EIHN0YWdlID0gXCJjbG9zZWRfd29uXCIgQU5EIGFtb3VudCA+IDEwMDAwMCcsXG4gICAgICBhY3RpdmU6IHRydWUsXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiAnbm90aWZ5X21hbmFnZW1lbnQnLFxuICAgICAgICAgIHR5cGU6ICdlbWFpbF9hbGVydCcsXG4gICAgICAgICAgdGVtcGxhdGU6ICdsYXJnZV9kZWFsX3dvbicsXG4gICAgICAgICAgcmVjaXBpZW50czogWydzYWxlc19tYW5hZ2VtZW50QGV4YW1wbGUuY29tJ10sXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgfVxuICBdLFxufSk7IiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvb2JqZWN0cy9wcm9kdWN0Lm9iamVjdC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9vYmplY3RzXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL29iamVjdHMvcHJvZHVjdC5vYmplY3QudHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbmltcG9ydCB7IE9iamVjdFNjaGVtYSwgRmllbGQgfSBmcm9tICdAb2JqZWN0c3RhY2svc3BlYy9kYXRhJztcblxuLyoqXG4gKiBQcm9kdWN0IE9iamVjdFxuICogUmVwcmVzZW50cyBwcm9kdWN0cy9zZXJ2aWNlcyBvZmZlcmVkIGJ5IHRoZSBjb21wYW55XG4gKi9cbmV4cG9ydCBjb25zdCBQcm9kdWN0ID0gT2JqZWN0U2NoZW1hLmNyZWF0ZSh7XG4gIG5hbWU6ICdwcm9kdWN0JyxcbiAgbGFiZWw6ICdQcm9kdWN0JyxcbiAgcGx1cmFsTGFiZWw6ICdQcm9kdWN0cycsXG4gIGljb246ICdib3gnLFxuICBkZXNjcmlwdGlvbjogJ1Byb2R1Y3RzIGFuZCBzZXJ2aWNlcyBvZmZlcmVkIGJ5IHRoZSBjb21wYW55JyxcbiAgdGl0bGVGb3JtYXQ6ICd7cHJvZHVjdF9jb2RlfSAtIHtuYW1lfScsXG4gIGNvbXBhY3RMYXlvdXQ6IFsncHJvZHVjdF9jb2RlJywgJ25hbWUnLCAnY2F0ZWdvcnknLCAnaXNfYWN0aXZlJ10sXG4gIFxuICBmaWVsZHM6IHtcbiAgICAvLyBBdXRvTnVtYmVyIGZpZWxkIC0gVW5pcXVlIHByb2R1Y3QgaWRlbnRpZmllclxuICAgIHByb2R1Y3RfY29kZTogRmllbGQuYXV0b251bWJlcih7XG4gICAgICBsYWJlbDogJ1Byb2R1Y3QgQ29kZScsXG4gICAgICBmb3JtYXQ6ICdQUkQtezAwMDB9JyxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBCYXNpYyBJbmZvcm1hdGlvblxuICAgIG5hbWU6IEZpZWxkLnRleHQoeyBcbiAgICAgIGxhYmVsOiAnUHJvZHVjdCBOYW1lJywgXG4gICAgICByZXF1aXJlZDogdHJ1ZSwgXG4gICAgICBzZWFyY2hhYmxlOiB0cnVlLFxuICAgICAgbWF4TGVuZ3RoOiAyNTUsXG4gICAgfSksXG4gICAgXG4gICAgZGVzY3JpcHRpb246IEZpZWxkLm1hcmtkb3duKHtcbiAgICAgIGxhYmVsOiAnRGVzY3JpcHRpb24nLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIENhdGVnb3JpemF0aW9uXG4gICAgY2F0ZWdvcnk6IEZpZWxkLnNlbGVjdCh7XG4gICAgICBsYWJlbDogJ0NhdGVnb3J5JyxcbiAgICAgIG9wdGlvbnM6IFtcbiAgICAgICAgeyBsYWJlbDogJ1NvZnR3YXJlJywgdmFsdWU6ICdzb2Z0d2FyZScsIGRlZmF1bHQ6IHRydWUgfSxcbiAgICAgICAgeyBsYWJlbDogJ0hhcmR3YXJlJywgdmFsdWU6ICdoYXJkd2FyZScgfSxcbiAgICAgICAgeyBsYWJlbDogJ1NlcnZpY2UnLCB2YWx1ZTogJ3NlcnZpY2UnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdTdWJzY3JpcHRpb24nLCB2YWx1ZTogJ3N1YnNjcmlwdGlvbicgfSxcbiAgICAgICAgeyBsYWJlbDogJ1N1cHBvcnQnLCB2YWx1ZTogJ3N1cHBvcnQnIH0sXG4gICAgICBdXG4gICAgfSksXG4gICAgXG4gICAgZmFtaWx5OiBGaWVsZC5zZWxlY3Qoe1xuICAgICAgbGFiZWw6ICdQcm9kdWN0IEZhbWlseScsXG4gICAgICBvcHRpb25zOiBbXG4gICAgICAgIHsgbGFiZWw6ICdFbnRlcnByaXNlIFNvbHV0aW9ucycsIHZhbHVlOiAnZW50ZXJwcmlzZScgfSxcbiAgICAgICAgeyBsYWJlbDogJ1NNQiBTb2x1dGlvbnMnLCB2YWx1ZTogJ3NtYicgfSxcbiAgICAgICAgeyBsYWJlbDogJ1Byb2Zlc3Npb25hbCBTZXJ2aWNlcycsIHZhbHVlOiAnc2VydmljZXMnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdDbG91ZCBTZXJ2aWNlcycsIHZhbHVlOiAnY2xvdWQnIH0sXG4gICAgICBdXG4gICAgfSksXG4gICAgXG4gICAgLy8gUHJpY2luZ1xuICAgIGxpc3RfcHJpY2U6IEZpZWxkLmN1cnJlbmN5KHsgXG4gICAgICBsYWJlbDogJ0xpc3QgUHJpY2UnLFxuICAgICAgc2NhbGU6IDIsXG4gICAgICBtaW46IDAsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICB9KSxcbiAgICBcbiAgICBjb3N0OiBGaWVsZC5jdXJyZW5jeSh7IFxuICAgICAgbGFiZWw6ICdDb3N0JyxcbiAgICAgIHNjYWxlOiAyLFxuICAgICAgbWluOiAwLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIFNLVSBhbmQgSW52ZW50b3J5XG4gICAgc2t1OiBGaWVsZC50ZXh0KHtcbiAgICAgIGxhYmVsOiAnU0tVJyxcbiAgICAgIG1heExlbmd0aDogNTAsXG4gICAgICB1bmlxdWU6IHRydWUsXG4gICAgfSksXG4gICAgXG4gICAgcXVhbnRpdHlfb25faGFuZDogRmllbGQubnVtYmVyKHtcbiAgICAgIGxhYmVsOiAnUXVhbnRpdHkgb24gSGFuZCcsXG4gICAgICBtaW46IDAsXG4gICAgICBkZWZhdWx0VmFsdWU6IDAsXG4gICAgfSksXG4gICAgXG4gICAgcmVvcmRlcl9wb2ludDogRmllbGQubnVtYmVyKHtcbiAgICAgIGxhYmVsOiAnUmVvcmRlciBQb2ludCcsXG4gICAgICBtaW46IDAsXG4gICAgfSksXG4gICAgXG4gICAgLy8gU3RhdHVzXG4gICAgaXNfYWN0aXZlOiBGaWVsZC5ib29sZWFuKHtcbiAgICAgIGxhYmVsOiAnQWN0aXZlJyxcbiAgICAgIGRlZmF1bHRWYWx1ZTogdHJ1ZSxcbiAgICB9KSxcbiAgICBcbiAgICBpc190YXhhYmxlOiBGaWVsZC5ib29sZWFuKHtcbiAgICAgIGxhYmVsOiAnVGF4YWJsZScsXG4gICAgICBkZWZhdWx0VmFsdWU6IHRydWUsXG4gICAgfSksXG4gICAgXG4gICAgLy8gUmVsYXRpb25zaGlwc1xuICAgIHByb2R1Y3RfbWFuYWdlcjogRmllbGQubG9va3VwKCd1c2VyJywge1xuICAgICAgbGFiZWw6ICdQcm9kdWN0IE1hbmFnZXInLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIEltYWdlcyBhbmQgQXNzZXRzXG4gICAgaW1hZ2VfdXJsOiBGaWVsZC51cmwoe1xuICAgICAgbGFiZWw6ICdQcm9kdWN0IEltYWdlJyxcbiAgICB9KSxcbiAgICBcbiAgICBkYXRhc2hlZXRfdXJsOiBGaWVsZC51cmwoe1xuICAgICAgbGFiZWw6ICdEYXRhc2hlZXQgVVJMJyxcbiAgICB9KSxcbiAgfSxcbiAgXG4gIC8vIERhdGFiYXNlIGluZGV4ZXNcbiAgaW5kZXhlczogW1xuICAgIHsgZmllbGRzOiBbJ25hbWUnXSwgdW5pcXVlOiBmYWxzZSB9LFxuICAgIHsgZmllbGRzOiBbJ3NrdSddLCB1bmlxdWU6IHRydWUgfSxcbiAgICB7IGZpZWxkczogWydjYXRlZ29yeSddLCB1bmlxdWU6IGZhbHNlIH0sXG4gICAgeyBmaWVsZHM6IFsnaXNfYWN0aXZlJ10sIHVuaXF1ZTogZmFsc2UgfSxcbiAgXSxcbiAgXG4gIC8vIEVuYWJsZSBhZHZhbmNlZCBmZWF0dXJlc1xuICBlbmFibGU6IHtcbiAgICB0cmFja0hpc3Rvcnk6IHRydWUsXG4gICAgc2VhcmNoYWJsZTogdHJ1ZSxcbiAgICBhcGlFbmFibGVkOiB0cnVlLFxuICAgIGFwaU1ldGhvZHM6IFsnZ2V0JywgJ2xpc3QnLCAnY3JlYXRlJywgJ3VwZGF0ZScsICdkZWxldGUnLCAnc2VhcmNoJ10sXG4gICAgZmlsZXM6IHRydWUsXG4gICAgZmVlZHM6IHRydWUsXG4gICAgdHJhc2g6IHRydWUsXG4gICAgbXJ1OiB0cnVlLFxuICB9LFxuICBcbiAgLy8gVmFsaWRhdGlvbiBSdWxlc1xuICB2YWxpZGF0aW9uczogW1xuICAgIHtcbiAgICAgIG5hbWU6ICdwcmljZV9wb3NpdGl2ZScsXG4gICAgICB0eXBlOiAnc2NyaXB0JyxcbiAgICAgIHNldmVyaXR5OiAnZXJyb3InLFxuICAgICAgbWVzc2FnZTogJ0xpc3QgUHJpY2UgbXVzdCBiZSBwb3NpdGl2ZScsXG4gICAgICBjb25kaXRpb246ICdsaXN0X3ByaWNlIDwgMCcsXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiAnY29zdF9sZXNzX3RoYW5fcHJpY2UnLFxuICAgICAgdHlwZTogJ3NjcmlwdCcsXG4gICAgICBzZXZlcml0eTogJ3dhcm5pbmcnLFxuICAgICAgbWVzc2FnZTogJ0Nvc3Qgc2hvdWxkIGJlIGxlc3MgdGhhbiBMaXN0IFByaWNlJyxcbiAgICAgIGNvbmRpdGlvbjogJ2Nvc3QgPj0gbGlzdF9wcmljZScsXG4gICAgfSxcbiAgXSxcbn0pO1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvb2JqZWN0cy9xdW90ZS5vYmplY3QudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvb2JqZWN0c1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9vYmplY3RzL3F1b3RlLm9iamVjdC50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuaW1wb3J0IHsgT2JqZWN0U2NoZW1hLCBGaWVsZCB9IGZyb20gJ0BvYmplY3RzdGFjay9zcGVjL2RhdGEnO1xuXG4vKipcbiAqIFF1b3RlIE9iamVjdFxuICogUmVwcmVzZW50cyBwcmljZSBxdW90ZXMgc2VudCB0byBjdXN0b21lcnNcbiAqL1xuZXhwb3J0IGNvbnN0IFF1b3RlID0gT2JqZWN0U2NoZW1hLmNyZWF0ZSh7XG4gIG5hbWU6ICdxdW90ZScsXG4gIGxhYmVsOiAnUXVvdGUnLFxuICBwbHVyYWxMYWJlbDogJ1F1b3RlcycsXG4gIGljb246ICdmaWxlLXRleHQnLFxuICBkZXNjcmlwdGlvbjogJ1ByaWNlIHF1b3RlcyBmb3IgY3VzdG9tZXJzJyxcbiAgdGl0bGVGb3JtYXQ6ICd7cXVvdGVfbnVtYmVyfSAtIHtuYW1lfScsXG4gIGNvbXBhY3RMYXlvdXQ6IFsncXVvdGVfbnVtYmVyJywgJ25hbWUnLCAnYWNjb3VudCcsICdzdGF0dXMnLCAndG90YWxfcHJpY2UnXSxcbiAgXG4gIGZpZWxkczoge1xuICAgIC8vIEF1dG9OdW1iZXIgZmllbGRcbiAgICBxdW90ZV9udW1iZXI6IEZpZWxkLmF1dG9udW1iZXIoe1xuICAgICAgbGFiZWw6ICdRdW90ZSBOdW1iZXInLFxuICAgICAgZm9ybWF0OiAnUVRFLXswMDAwfScsXG4gICAgfSksXG4gICAgXG4gICAgLy8gQmFzaWMgSW5mb3JtYXRpb25cbiAgICBuYW1lOiBGaWVsZC50ZXh0KHsgXG4gICAgICBsYWJlbDogJ1F1b3RlIE5hbWUnLCBcbiAgICAgIHJlcXVpcmVkOiB0cnVlLCBcbiAgICAgIHNlYXJjaGFibGU6IHRydWUsXG4gICAgICBtYXhMZW5ndGg6IDI1NSxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBSZWxhdGlvbnNoaXBzXG4gICAgYWNjb3VudDogRmllbGQubG9va3VwKCdhY2NvdW50Jywge1xuICAgICAgbGFiZWw6ICdBY2NvdW50JyxcbiAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIGNvbnRhY3Q6IEZpZWxkLmxvb2t1cCgnY29udGFjdCcsIHtcbiAgICAgIGxhYmVsOiAnQ29udGFjdCcsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgIHJlZmVyZW5jZUZpbHRlcnM6IFtcbiAgICAgICAgJ2FjY291bnQgPSB7YWNjb3VudH0nLFxuICAgICAgXVxuICAgIH0pLFxuICAgIFxuICAgIG9wcG9ydHVuaXR5OiBGaWVsZC5sb29rdXAoJ29wcG9ydHVuaXR5Jywge1xuICAgICAgbGFiZWw6ICdPcHBvcnR1bml0eScsXG4gICAgICByZWZlcmVuY2VGaWx0ZXJzOiBbXG4gICAgICAgICdhY2NvdW50ID0ge2FjY291bnR9JyxcbiAgICAgIF1cbiAgICB9KSxcbiAgICBcbiAgICBvd25lcjogRmllbGQubG9va3VwKCd1c2VyJywge1xuICAgICAgbGFiZWw6ICdRdW90ZSBPd25lcicsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBTdGF0dXNcbiAgICBzdGF0dXM6IEZpZWxkLnNlbGVjdCh7XG4gICAgICBsYWJlbDogJ1N0YXR1cycsXG4gICAgICBvcHRpb25zOiBbXG4gICAgICAgIHsgbGFiZWw6ICdEcmFmdCcsIHZhbHVlOiAnZHJhZnQnLCBjb2xvcjogJyM5OTk5OTknLCBkZWZhdWx0OiB0cnVlIH0sXG4gICAgICAgIHsgbGFiZWw6ICdJbiBSZXZpZXcnLCB2YWx1ZTogJ2luX3JldmlldycsIGNvbG9yOiAnI0ZGQTUwMCcgfSxcbiAgICAgICAgeyBsYWJlbDogJ1ByZXNlbnRlZCcsIHZhbHVlOiAncHJlc2VudGVkJywgY29sb3I6ICcjNDE2OUUxJyB9LFxuICAgICAgICB7IGxhYmVsOiAnQWNjZXB0ZWQnLCB2YWx1ZTogJ2FjY2VwdGVkJywgY29sb3I6ICcjMDBBQTAwJyB9LFxuICAgICAgICB7IGxhYmVsOiAnUmVqZWN0ZWQnLCB2YWx1ZTogJ3JlamVjdGVkJywgY29sb3I6ICcjRkYwMDAwJyB9LFxuICAgICAgICB7IGxhYmVsOiAnRXhwaXJlZCcsIHZhbHVlOiAnZXhwaXJlZCcsIGNvbG9yOiAnIzY2NjY2NicgfSxcbiAgICAgIF0sXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBEYXRlc1xuICAgIHF1b3RlX2RhdGU6IEZpZWxkLmRhdGUoe1xuICAgICAgbGFiZWw6ICdRdW90ZSBEYXRlJyxcbiAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgZGVmYXVsdFZhbHVlOiAnVE9EQVkoKScsXG4gICAgfSksXG4gICAgXG4gICAgZXhwaXJhdGlvbl9kYXRlOiBGaWVsZC5kYXRlKHtcbiAgICAgIGxhYmVsOiAnRXhwaXJhdGlvbiBEYXRlJyxcbiAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIFByaWNpbmdcbiAgICBzdWJ0b3RhbDogRmllbGQuY3VycmVuY3koeyBcbiAgICAgIGxhYmVsOiAnU3VidG90YWwnLFxuICAgICAgc2NhbGU6IDIsXG4gICAgICByZWFkb25seTogdHJ1ZSxcbiAgICB9KSxcbiAgICBcbiAgICBkaXNjb3VudDogRmllbGQucGVyY2VudCh7XG4gICAgICBsYWJlbDogJ0Rpc2NvdW50ICUnLFxuICAgICAgc2NhbGU6IDIsXG4gICAgICBtaW46IDAsXG4gICAgICBtYXg6IDEwMCxcbiAgICB9KSxcbiAgICBcbiAgICBkaXNjb3VudF9hbW91bnQ6IEZpZWxkLmN1cnJlbmN5KHsgXG4gICAgICBsYWJlbDogJ0Rpc2NvdW50IEFtb3VudCcsXG4gICAgICBzY2FsZTogMixcbiAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIHRheDogRmllbGQuY3VycmVuY3koeyBcbiAgICAgIGxhYmVsOiAnVGF4JyxcbiAgICAgIHNjYWxlOiAyLFxuICAgIH0pLFxuICAgIFxuICAgIHNoaXBwaW5nX2hhbmRsaW5nOiBGaWVsZC5jdXJyZW5jeSh7IFxuICAgICAgbGFiZWw6ICdTaGlwcGluZyAmIEhhbmRsaW5nJyxcbiAgICAgIHNjYWxlOiAyLFxuICAgIH0pLFxuICAgIFxuICAgIHRvdGFsX3ByaWNlOiBGaWVsZC5jdXJyZW5jeSh7IFxuICAgICAgbGFiZWw6ICdUb3RhbCBQcmljZScsXG4gICAgICBzY2FsZTogMixcbiAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIFRlcm1zXG4gICAgcGF5bWVudF90ZXJtczogRmllbGQuc2VsZWN0KHtcbiAgICAgIGxhYmVsOiAnUGF5bWVudCBUZXJtcycsXG4gICAgICBvcHRpb25zOiBbXG4gICAgICAgIHsgbGFiZWw6ICdOZXQgMTUnLCB2YWx1ZTogJ25ldF8xNScgfSxcbiAgICAgICAgeyBsYWJlbDogJ05ldCAzMCcsIHZhbHVlOiAnbmV0XzMwJywgZGVmYXVsdDogdHJ1ZSB9LFxuICAgICAgICB7IGxhYmVsOiAnTmV0IDYwJywgdmFsdWU6ICduZXRfNjAnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdOZXQgOTAnLCB2YWx1ZTogJ25ldF85MCcgfSxcbiAgICAgICAgeyBsYWJlbDogJ0R1ZSBvbiBSZWNlaXB0JywgdmFsdWU6ICdkdWVfb25fcmVjZWlwdCcgfSxcbiAgICAgIF1cbiAgICB9KSxcbiAgICBcbiAgICBzaGlwcGluZ190ZXJtczogRmllbGQudGV4dCh7XG4gICAgICBsYWJlbDogJ1NoaXBwaW5nIFRlcm1zJyxcbiAgICAgIG1heExlbmd0aDogMjU1LFxuICAgIH0pLFxuICAgIFxuICAgIC8vIEJpbGxpbmcgJiBTaGlwcGluZyBBZGRyZXNzXG4gICAgYmlsbGluZ19hZGRyZXNzOiBGaWVsZC5hZGRyZXNzKHtcbiAgICAgIGxhYmVsOiAnQmlsbGluZyBBZGRyZXNzJyxcbiAgICAgIGFkZHJlc3NGb3JtYXQ6ICdpbnRlcm5hdGlvbmFsJyxcbiAgICB9KSxcbiAgICBcbiAgICBzaGlwcGluZ19hZGRyZXNzOiBGaWVsZC5hZGRyZXNzKHtcbiAgICAgIGxhYmVsOiAnU2hpcHBpbmcgQWRkcmVzcycsXG4gICAgICBhZGRyZXNzRm9ybWF0OiAnaW50ZXJuYXRpb25hbCcsXG4gICAgfSksXG4gICAgXG4gICAgLy8gTm90ZXNcbiAgICBkZXNjcmlwdGlvbjogRmllbGQubWFya2Rvd24oe1xuICAgICAgbGFiZWw6ICdEZXNjcmlwdGlvbicsXG4gICAgfSksXG4gICAgXG4gICAgaW50ZXJuYWxfbm90ZXM6IEZpZWxkLnRleHRhcmVhKHtcbiAgICAgIGxhYmVsOiAnSW50ZXJuYWwgTm90ZXMnLFxuICAgIH0pLFxuICB9LFxuICBcbiAgLy8gRGF0YWJhc2UgaW5kZXhlc1xuICBpbmRleGVzOiBbXG4gICAgeyBmaWVsZHM6IFsnYWNjb3VudCddLCB1bmlxdWU6IGZhbHNlIH0sXG4gICAgeyBmaWVsZHM6IFsnb3Bwb3J0dW5pdHknXSwgdW5pcXVlOiBmYWxzZSB9LFxuICAgIHsgZmllbGRzOiBbJ293bmVyJ10sIHVuaXF1ZTogZmFsc2UgfSxcbiAgICB7IGZpZWxkczogWydzdGF0dXMnXSwgdW5pcXVlOiBmYWxzZSB9LFxuICAgIHsgZmllbGRzOiBbJ3F1b3RlX2RhdGUnXSwgdW5pcXVlOiBmYWxzZSB9LFxuICBdLFxuICBcbiAgLy8gRW5hYmxlIGFkdmFuY2VkIGZlYXR1cmVzXG4gIGVuYWJsZToge1xuICAgIHRyYWNrSGlzdG9yeTogdHJ1ZSxcbiAgICBzZWFyY2hhYmxlOiB0cnVlLFxuICAgIGFwaUVuYWJsZWQ6IHRydWUsXG4gICAgYXBpTWV0aG9kczogWydnZXQnLCAnbGlzdCcsICdjcmVhdGUnLCAndXBkYXRlJywgJ2RlbGV0ZScsICdzZWFyY2gnLCAnZXhwb3J0J10sXG4gICAgZmlsZXM6IHRydWUsXG4gICAgZmVlZHM6IHRydWUsXG4gICAgYWN0aXZpdGllczogdHJ1ZSxcbiAgICB0cmFzaDogdHJ1ZSxcbiAgICBtcnU6IHRydWUsXG4gIH0sXG4gIFxuICAvLyBWYWxpZGF0aW9uIFJ1bGVzXG4gIHZhbGlkYXRpb25zOiBbXG4gICAge1xuICAgICAgbmFtZTogJ2V4cGlyYXRpb25fYWZ0ZXJfcXVvdGUnLFxuICAgICAgdHlwZTogJ3NjcmlwdCcsXG4gICAgICBzZXZlcml0eTogJ2Vycm9yJyxcbiAgICAgIG1lc3NhZ2U6ICdFeHBpcmF0aW9uIERhdGUgbXVzdCBiZSBhZnRlciBRdW90ZSBEYXRlJyxcbiAgICAgIGNvbmRpdGlvbjogJ2V4cGlyYXRpb25fZGF0ZSA8PSBxdW90ZV9kYXRlJyxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICd2YWxpZF9kaXNjb3VudCcsXG4gICAgICB0eXBlOiAnc2NyaXB0JyxcbiAgICAgIHNldmVyaXR5OiAnZXJyb3InLFxuICAgICAgbWVzc2FnZTogJ0Rpc2NvdW50IGNhbm5vdCBleGNlZWQgMTAwJScsXG4gICAgICBjb25kaXRpb246ICdkaXNjb3VudCA+IDEwMCcsXG4gICAgfSxcbiAgXSxcbiAgXG4gIC8vIFdvcmtmbG93IFJ1bGVzXG4gIHdvcmtmbG93czogW1xuICAgIHtcbiAgICAgIG5hbWU6ICdxdW90ZV9leHBpcmVkX2NoZWNrJyxcbiAgICAgIG9iamVjdE5hbWU6ICdxdW90ZScsXG4gICAgICB0cmlnZ2VyVHlwZTogJ29uX3JlYWQnLFxuICAgICAgY3JpdGVyaWE6ICdleHBpcmF0aW9uX2RhdGUgPCBUT0RBWSgpIEFORCBzdGF0dXMgTk9UIElOIChcImFjY2VwdGVkXCIsIFwicmVqZWN0ZWRcIiwgXCJleHBpcmVkXCIpJyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICdtYXJrX2V4cGlyZWQnLFxuICAgICAgICAgIHR5cGU6ICdmaWVsZF91cGRhdGUnLFxuICAgICAgICAgIGZpZWxkOiAnc3RhdHVzJyxcbiAgICAgICAgICB2YWx1ZTogJ1wiZXhwaXJlZFwiJyxcbiAgICAgICAgfVxuICAgICAgXSxcbiAgICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICB9XG4gIF0sXG59KTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL29iamVjdHMvdGFzay5vYmplY3QudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvb2JqZWN0c1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9vYmplY3RzL3Rhc2sub2JqZWN0LnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5pbXBvcnQgeyBPYmplY3RTY2hlbWEsIEZpZWxkIH0gZnJvbSAnQG9iamVjdHN0YWNrL3NwZWMvZGF0YSc7XG5cbmV4cG9ydCBjb25zdCBUYXNrID0gT2JqZWN0U2NoZW1hLmNyZWF0ZSh7XG4gIG5hbWU6ICd0YXNrJyxcbiAgbGFiZWw6ICdUYXNrJyxcbiAgcGx1cmFsTGFiZWw6ICdUYXNrcycsXG4gIGljb246ICdjaGVjay1zcXVhcmUnLFxuICBkZXNjcmlwdGlvbjogJ0FjdGl2aXRpZXMgYW5kIHRvLWRvIGl0ZW1zJyxcbiAgXG4gIGZpZWxkczoge1xuICAgIC8vIFRhc2sgSW5mb3JtYXRpb25cbiAgICBzdWJqZWN0OiBGaWVsZC50ZXh0KHtcbiAgICAgIGxhYmVsOiAnU3ViamVjdCcsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgIHNlYXJjaGFibGU6IHRydWUsXG4gICAgICBtYXhMZW5ndGg6IDI1NSxcbiAgICB9KSxcbiAgICBcbiAgICBkZXNjcmlwdGlvbjogRmllbGQubWFya2Rvd24oe1xuICAgICAgbGFiZWw6ICdEZXNjcmlwdGlvbicsXG4gICAgfSksXG4gICAgXG4gICAgLy8gVGFzayBNYW5hZ2VtZW50XG4gICAgc3RhdHVzOiB7XG4gICAgICB0eXBlOiAnc2VsZWN0JyxcbiAgICAgIGxhYmVsOiAnU3RhdHVzJyxcbiAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgb3B0aW9uczogW1xuICAgICAgICB7IGxhYmVsOiAnTm90IFN0YXJ0ZWQnLCB2YWx1ZTogJ25vdF9zdGFydGVkJywgY29sb3I6ICcjODA4MDgwJywgZGVmYXVsdDogdHJ1ZSB9LFxuICAgICAgICB7IGxhYmVsOiAnSW4gUHJvZ3Jlc3MnLCB2YWx1ZTogJ2luX3Byb2dyZXNzJywgY29sb3I6ICcjRkZBNTAwJyB9LFxuICAgICAgICB7IGxhYmVsOiAnV2FpdGluZycsIHZhbHVlOiAnd2FpdGluZycsIGNvbG9yOiAnI0ZGRDcwMCcgfSxcbiAgICAgICAgeyBsYWJlbDogJ0NvbXBsZXRlZCcsIHZhbHVlOiAnY29tcGxldGVkJywgY29sb3I6ICcjMDBBQTAwJyB9LFxuICAgICAgICB7IGxhYmVsOiAnRGVmZXJyZWQnLCB2YWx1ZTogJ2RlZmVycmVkJywgY29sb3I6ICcjOTk5OTk5JyB9LFxuICAgICAgXVxuICAgIH0sXG4gICAgXG4gICAgcHJpb3JpdHk6IHtcbiAgICAgIHR5cGU6ICdzZWxlY3QnLFxuICAgICAgbGFiZWw6ICdQcmlvcml0eScsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgIG9wdGlvbnM6IFtcbiAgICAgICAgeyBsYWJlbDogJ0xvdycsIHZhbHVlOiAnbG93JywgY29sb3I6ICcjNDE2OUUxJywgZGVmYXVsdDogdHJ1ZSB9LFxuICAgICAgICB7IGxhYmVsOiAnTm9ybWFsJywgdmFsdWU6ICdub3JtYWwnLCBjb2xvcjogJyMwMEFBMDAnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdIaWdoJywgdmFsdWU6ICdoaWdoJywgY29sb3I6ICcjRkZBNTAwJyB9LFxuICAgICAgICB7IGxhYmVsOiAnVXJnZW50JywgdmFsdWU6ICd1cmdlbnQnLCBjb2xvcjogJyNGRjAwMDAnIH0sXG4gICAgICBdXG4gICAgfSxcbiAgICBcbiAgICB0eXBlOiBGaWVsZC5zZWxlY3QoWydDYWxsJywgJ0VtYWlsJywgJ01lZXRpbmcnLCAnRm9sbG93LXVwJywgJ0RlbW8nLCAnT3RoZXInXSwge1xuICAgICAgbGFiZWw6ICdUYXNrIFR5cGUnLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIERhdGVzXG4gICAgZHVlX2RhdGU6IEZpZWxkLmRhdGUoe1xuICAgICAgbGFiZWw6ICdEdWUgRGF0ZScsXG4gICAgfSksXG4gICAgXG4gICAgcmVtaW5kZXJfZGF0ZTogRmllbGQuZGF0ZXRpbWUoe1xuICAgICAgbGFiZWw6ICdSZW1pbmRlciBEYXRlL1RpbWUnLFxuICAgIH0pLFxuICAgIFxuICAgIGNvbXBsZXRlZF9kYXRlOiBGaWVsZC5kYXRldGltZSh7XG4gICAgICBsYWJlbDogJ0NvbXBsZXRlZCBEYXRlJyxcbiAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIEFzc2lnbm1lbnRcbiAgICBvd25lcjogRmllbGQubG9va3VwKCd1c2VyJywge1xuICAgICAgbGFiZWw6ICdBc3NpZ25lZCBUbycsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBSZWxhdGVkIFRvIChQb2x5bW9ycGhpYyByZWxhdGlvbnNoaXAgLSBjYW4gbGluayB0byBtdWx0aXBsZSBvYmplY3QgdHlwZXMpXG4gICAgcmVsYXRlZF90b190eXBlOiBGaWVsZC5zZWxlY3QoWydBY2NvdW50JywgJ0NvbnRhY3QnLCAnT3Bwb3J0dW5pdHknLCAnTGVhZCcsICdDYXNlJ10sIHtcbiAgICAgIGxhYmVsOiAnUmVsYXRlZCBUbyBUeXBlJyxcbiAgICB9KSxcbiAgICBcbiAgICByZWxhdGVkX3RvX2FjY291bnQ6IEZpZWxkLmxvb2t1cCgnYWNjb3VudCcsIHtcbiAgICAgIGxhYmVsOiAnUmVsYXRlZCBBY2NvdW50JyxcbiAgICB9KSxcbiAgICBcbiAgICByZWxhdGVkX3RvX2NvbnRhY3Q6IEZpZWxkLmxvb2t1cCgnY29udGFjdCcsIHtcbiAgICAgIGxhYmVsOiAnUmVsYXRlZCBDb250YWN0JyxcbiAgICB9KSxcbiAgICBcbiAgICByZWxhdGVkX3RvX29wcG9ydHVuaXR5OiBGaWVsZC5sb29rdXAoJ29wcG9ydHVuaXR5Jywge1xuICAgICAgbGFiZWw6ICdSZWxhdGVkIE9wcG9ydHVuaXR5JyxcbiAgICB9KSxcbiAgICBcbiAgICByZWxhdGVkX3RvX2xlYWQ6IEZpZWxkLmxvb2t1cCgnbGVhZCcsIHtcbiAgICAgIGxhYmVsOiAnUmVsYXRlZCBMZWFkJyxcbiAgICB9KSxcbiAgICBcbiAgICByZWxhdGVkX3RvX2Nhc2U6IEZpZWxkLmxvb2t1cCgnY2FzZScsIHtcbiAgICAgIGxhYmVsOiAnUmVsYXRlZCBDYXNlJyxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBSZWN1cnJlbmNlIChmb3IgcmVjdXJyaW5nIHRhc2tzKVxuICAgIGlzX3JlY3VycmluZzogRmllbGQuYm9vbGVhbih7XG4gICAgICBsYWJlbDogJ1JlY3VycmluZyBUYXNrJyxcbiAgICAgIGRlZmF1bHRWYWx1ZTogZmFsc2UsXG4gICAgfSksXG4gICAgXG4gICAgcmVjdXJyZW5jZV90eXBlOiBGaWVsZC5zZWxlY3QoWydEYWlseScsICdXZWVrbHknLCAnTW9udGhseScsICdZZWFybHknXSwge1xuICAgICAgbGFiZWw6ICdSZWN1cnJlbmNlIFR5cGUnLFxuICAgIH0pLFxuICAgIFxuICAgIHJlY3VycmVuY2VfaW50ZXJ2YWw6IEZpZWxkLm51bWJlcih7XG4gICAgICBsYWJlbDogJ1JlY3VycmVuY2UgSW50ZXJ2YWwnLFxuICAgICAgZGVmYXVsdFZhbHVlOiAxLFxuICAgICAgbWluOiAxLFxuICAgIH0pLFxuICAgIFxuICAgIHJlY3VycmVuY2VfZW5kX2RhdGU6IEZpZWxkLmRhdGUoe1xuICAgICAgbGFiZWw6ICdSZWN1cnJlbmNlIEVuZCBEYXRlJyxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBGbGFnc1xuICAgIGlzX2NvbXBsZXRlZDogRmllbGQuYm9vbGVhbih7XG4gICAgICBsYWJlbDogJ0lzIENvbXBsZXRlZCcsXG4gICAgICBkZWZhdWx0VmFsdWU6IGZhbHNlLFxuICAgICAgcmVhZG9ubHk6IHRydWUsXG4gICAgfSksXG4gICAgXG4gICAgaXNfb3ZlcmR1ZTogRmllbGQuYm9vbGVhbih7XG4gICAgICBsYWJlbDogJ0lzIE92ZXJkdWUnLFxuICAgICAgZGVmYXVsdFZhbHVlOiBmYWxzZSxcbiAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIFByb2dyZXNzXG4gICAgcHJvZ3Jlc3NfcGVyY2VudDogRmllbGQucGVyY2VudCh7XG4gICAgICBsYWJlbDogJ1Byb2dyZXNzICglKScsXG4gICAgICBtaW46IDAsXG4gICAgICBtYXg6IDEwMCxcbiAgICAgIGRlZmF1bHRWYWx1ZTogMCxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBUaW1lIHRyYWNraW5nXG4gICAgZXN0aW1hdGVkX2hvdXJzOiBGaWVsZC5udW1iZXIoe1xuICAgICAgbGFiZWw6ICdFc3RpbWF0ZWQgSG91cnMnLFxuICAgICAgc2NhbGU6IDIsXG4gICAgICBtaW46IDAsXG4gICAgfSksXG4gICAgXG4gICAgYWN0dWFsX2hvdXJzOiBGaWVsZC5udW1iZXIoe1xuICAgICAgbGFiZWw6ICdBY3R1YWwgSG91cnMnLFxuICAgICAgc2NhbGU6IDIsXG4gICAgICBtaW46IDAsXG4gICAgfSksXG4gIH0sXG4gIFxuICBlbmFibGU6IHtcbiAgICB0cmFja0hpc3Rvcnk6IHRydWUsXG4gICAgc2VhcmNoYWJsZTogdHJ1ZSxcbiAgICBhcGlFbmFibGVkOiB0cnVlLFxuICAgIGZpbGVzOiB0cnVlLFxuICAgIGZlZWRzOiB0cnVlLCAgICAgICAgICAgIC8vIEVuYWJsZSBzb2NpYWwgZmVlZCwgY29tbWVudHMsIGFuZCBtZW50aW9uc1xuICAgIGFjdGl2aXRpZXM6IHRydWUsICAgICAgIC8vIEVuYWJsZSB0YXNrcyBhbmQgZXZlbnRzIHRyYWNraW5nXG4gICAgdHJhc2g6IHRydWUsXG4gICAgbXJ1OiB0cnVlLCAgICAgICAgICAgICAgLy8gVHJhY2sgTW9zdCBSZWNlbnRseSBVc2VkXG4gIH0sXG4gIFxuICB0aXRsZUZvcm1hdDogJ3tzdWJqZWN0fScsXG4gIGNvbXBhY3RMYXlvdXQ6IFsnc3ViamVjdCcsICdzdGF0dXMnLCAncHJpb3JpdHknLCAnZHVlX2RhdGUnLCAnb3duZXInXSxcbiAgXG4gIC8vIFJlbW92ZWQ6IGxpc3Rfdmlld3MgYW5kIGZvcm1fdmlld3MgYmVsb25nIGluIFVJIGNvbmZpZ3VyYXRpb24sIG5vdCBvYmplY3QgZGVmaW5pdGlvblxuICBcbiAgdmFsaWRhdGlvbnM6IFtcbiAgICB7XG4gICAgICBuYW1lOiAnY29tcGxldGVkX2RhdGVfcmVxdWlyZWQnLFxuICAgICAgdHlwZTogJ3NjcmlwdCcsXG4gICAgICBzZXZlcml0eTogJ2Vycm9yJyxcbiAgICAgIG1lc3NhZ2U6ICdDb21wbGV0ZWQgZGF0ZSBpcyByZXF1aXJlZCB3aGVuIHN0YXR1cyBpcyBDb21wbGV0ZWQnLFxuICAgICAgY29uZGl0aW9uOiAnc3RhdHVzID0gXCJjb21wbGV0ZWRcIiBBTkQgSVNCTEFOSyhjb21wbGV0ZWRfZGF0ZSknLFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJ3JlY3VycmVuY2VfZmllbGRzX3JlcXVpcmVkJyxcbiAgICAgIHR5cGU6ICdzY3JpcHQnLFxuICAgICAgc2V2ZXJpdHk6ICdlcnJvcicsXG4gICAgICBtZXNzYWdlOiAnUmVjdXJyZW5jZSB0eXBlIGlzIHJlcXVpcmVkIGZvciByZWN1cnJpbmcgdGFza3MnLFxuICAgICAgY29uZGl0aW9uOiAnaXNfcmVjdXJyaW5nID0gdHJ1ZSBBTkQgSVNCTEFOSyhyZWN1cnJlbmNlX3R5cGUpJyxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICdyZWxhdGVkX3RvX3JlcXVpcmVkJyxcbiAgICAgIHR5cGU6ICdzY3JpcHQnLFxuICAgICAgc2V2ZXJpdHk6ICd3YXJuaW5nJyxcbiAgICAgIG1lc3NhZ2U6ICdBdCBsZWFzdCBvbmUgcmVsYXRlZCByZWNvcmQgc2hvdWxkIGJlIHNlbGVjdGVkJyxcbiAgICAgIGNvbmRpdGlvbjogJ0lTQkxBTksocmVsYXRlZF90b19hY2NvdW50KSBBTkQgSVNCTEFOSyhyZWxhdGVkX3RvX2NvbnRhY3QpIEFORCBJU0JMQU5LKHJlbGF0ZWRfdG9fb3Bwb3J0dW5pdHkpIEFORCBJU0JMQU5LKHJlbGF0ZWRfdG9fbGVhZCkgQU5EIElTQkxBTksocmVsYXRlZF90b19jYXNlKScsXG4gICAgfSxcbiAgXSxcbiAgXG4gIHdvcmtmbG93czogW1xuICAgIHtcbiAgICAgIG5hbWU6ICdzZXRfY29tcGxldGVkX2ZsYWcnLFxuICAgICAgb2JqZWN0TmFtZTogJ3Rhc2snLFxuICAgICAgdHJpZ2dlclR5cGU6ICdvbl9jcmVhdGVfb3JfdXBkYXRlJyxcbiAgICAgIGNyaXRlcmlhOiAnSVNDSEFOR0VEKHN0YXR1cyknLFxuICAgICAgYWN0aXZlOiB0cnVlLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogJ3VwZGF0ZV9jb21wbGV0ZWRfZmxhZycsXG4gICAgICAgICAgdHlwZTogJ2ZpZWxkX3VwZGF0ZScsXG4gICAgICAgICAgZmllbGQ6ICdpc19jb21wbGV0ZWQnLFxuICAgICAgICAgIHZhbHVlOiAnc3RhdHVzID0gXCJjb21wbGV0ZWRcIicsXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiAnc2V0X2NvbXBsZXRlZF9kYXRlJyxcbiAgICAgIG9iamVjdE5hbWU6ICd0YXNrJyxcbiAgICAgIHRyaWdnZXJUeXBlOiAnb25fdXBkYXRlJyxcbiAgICAgIGNyaXRlcmlhOiAnSVNDSEFOR0VEKHN0YXR1cykgQU5EIHN0YXR1cyA9IFwiY29tcGxldGVkXCInLFxuICAgICAgYWN0aXZlOiB0cnVlLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogJ3NldF9kYXRlJyxcbiAgICAgICAgICB0eXBlOiAnZmllbGRfdXBkYXRlJyxcbiAgICAgICAgICBmaWVsZDogJ2NvbXBsZXRlZF9kYXRlJyxcbiAgICAgICAgICB2YWx1ZTogJ05PVygpJyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICdzZXRfcHJvZ3Jlc3MnLFxuICAgICAgICAgIHR5cGU6ICdmaWVsZF91cGRhdGUnLFxuICAgICAgICAgIGZpZWxkOiAncHJvZ3Jlc3NfcGVyY2VudCcsXG4gICAgICAgICAgdmFsdWU6ICcxMDAnLFxuICAgICAgICB9XG4gICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJ2NoZWNrX292ZXJkdWUnLFxuICAgICAgb2JqZWN0TmFtZTogJ3Rhc2snLFxuICAgICAgdHJpZ2dlclR5cGU6ICdvbl9jcmVhdGVfb3JfdXBkYXRlJyxcbiAgICAgIGNyaXRlcmlhOiAnZHVlX2RhdGUgPCBUT0RBWSgpIEFORCBpc19jb21wbGV0ZWQgPSBmYWxzZScsXG4gICAgICBhY3RpdmU6IHRydWUsXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiAnc2V0X292ZXJkdWVfZmxhZycsXG4gICAgICAgICAgdHlwZTogJ2ZpZWxkX3VwZGF0ZScsXG4gICAgICAgICAgZmllbGQ6ICdpc19vdmVyZHVlJyxcbiAgICAgICAgICB2YWx1ZTogJ3RydWUnLFxuICAgICAgICB9XG4gICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJ25vdGlmeV9vbl91cmdlbnQnLFxuICAgICAgb2JqZWN0TmFtZTogJ3Rhc2snLFxuICAgICAgdHJpZ2dlclR5cGU6ICdvbl9jcmVhdGVfb3JfdXBkYXRlJyxcbiAgICAgIGNyaXRlcmlhOiAncHJpb3JpdHkgPSBcInVyZ2VudFwiIEFORCBpc19jb21wbGV0ZWQgPSBmYWxzZScsXG4gICAgICBhY3RpdmU6IHRydWUsXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiAnZW1haWxfb3duZXInLFxuICAgICAgICAgIHR5cGU6ICdlbWFpbF9hbGVydCcsXG4gICAgICAgICAgdGVtcGxhdGU6ICd1cmdlbnRfdGFza19hbGVydCcsXG4gICAgICAgICAgcmVjaXBpZW50czogWyd7b3duZXIuZW1haWx9J10sXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgfSxcbiAgXSxcbn0pO1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvYXBpcy9pbmRleC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9hcGlzXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2FwaXMvaW5kZXgudHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbi8qKlxuICogQVBJIERlZmluaXRpb25zIEJhcnJlbFxuICovXG5leHBvcnQgeyBMZWFkQ29udmVydEFwaSB9IGZyb20gJy4vbGVhZC1jb252ZXJ0LmFwaSc7XG5leHBvcnQgeyBQaXBlbGluZVN0YXRzQXBpIH0gZnJvbSAnLi9waXBlbGluZS1zdGF0cy5hcGknO1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvYXBpcy9sZWFkLWNvbnZlcnQuYXBpLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2FwaXNcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvYXBpcy9sZWFkLWNvbnZlcnQuYXBpLnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5pbXBvcnQgeyBBcGlFbmRwb2ludCB9IGZyb20gJ0BvYmplY3RzdGFjay9zcGVjL2FwaSc7XG5cbi8qKiBQT1NUIC9hcGkvdjEvY3JtL2xlYWRzL2NvbnZlcnQgKi9cbmV4cG9ydCBjb25zdCBMZWFkQ29udmVydEFwaSA9IEFwaUVuZHBvaW50LmNyZWF0ZSh7XG4gIG5hbWU6ICdsZWFkX2NvbnZlcnQnLFxuICBwYXRoOiAnL2FwaS92MS9jcm0vbGVhZHMvY29udmVydCcsXG4gIG1ldGhvZDogJ1BPU1QnLFxuICBzdW1tYXJ5OiAnQ29udmVydCBMZWFkIHRvIEFjY291bnQvQ29udGFjdCcsXG4gIHR5cGU6ICdmbG93JyxcbiAgdGFyZ2V0OiAnZmxvd19sZWFkX2NvbnZlcnNpb25fdjInLFxuICBpbnB1dE1hcHBpbmc6IFtcbiAgICB7IHNvdXJjZTogJ2JvZHkubGVhZElkJywgdGFyZ2V0OiAnbGVhZFJlY29yZElkJyB9LFxuICAgIHsgc291cmNlOiAnYm9keS5vd25lcklkJywgdGFyZ2V0OiAnbmV3T3duZXJJZCcgfSxcbiAgXSxcbn0pO1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvYXBpcy9waXBlbGluZS1zdGF0cy5hcGkudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvYXBpc1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9hcGlzL3BpcGVsaW5lLXN0YXRzLmFwaS50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuaW1wb3J0IHsgQXBpRW5kcG9pbnQgfSBmcm9tICdAb2JqZWN0c3RhY2svc3BlYy9hcGknO1xuXG4vKiogR0VUIC9hcGkvdjEvY3JtL3N0YXRzL3BpcGVsaW5lICovXG5leHBvcnQgY29uc3QgUGlwZWxpbmVTdGF0c0FwaSA9IEFwaUVuZHBvaW50LmNyZWF0ZSh7XG4gIG5hbWU6ICdnZXRfcGlwZWxpbmVfc3RhdHMnLFxuICBwYXRoOiAnL2FwaS92MS9jcm0vc3RhdHMvcGlwZWxpbmUnLFxuICBtZXRob2Q6ICdHRVQnLFxuICBzdW1tYXJ5OiAnR2V0IFBpcGVsaW5lIFN0YXRpc3RpY3MnLFxuICBkZXNjcmlwdGlvbjogJ1JldHVybnMgdGhlIHRvdGFsIHZhbHVlIG9mIG9wZW4gb3Bwb3J0dW5pdGllcyBncm91cGVkIGJ5IHN0YWdlJyxcbiAgdHlwZTogJ3NjcmlwdCcsXG4gIHRhcmdldDogJ3NlcnZlci9zY3JpcHRzL3BpcGVsaW5lX3N0YXRzLnRzJyxcbiAgYXV0aFJlcXVpcmVkOiB0cnVlLFxuICBjYWNoZVR0bDogMzAwLFxufSk7XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9hY3Rpb25zL2luZGV4LnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2FjdGlvbnNcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvYWN0aW9ucy9pbmRleC50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuLyoqXG4gKiBBY3Rpb24gRGVmaW5pdGlvbnMgQmFycmVsXG4gKlxuICogRXhwb3J0cyBhY3Rpb24gbWV0YWRhdGEgZGVmaW5pdGlvbnMgb25seS4gVXNlZCBieSBgT2JqZWN0LnZhbHVlcygpYCBpblxuICogb2JqZWN0c3RhY2suY29uZmlnLnRzIHRvIGF1dG8tY29sbGVjdCBhbGwgYWN0aW9uIGRlY2xhcmF0aW9ucyBmb3IgZGVmaW5lU3RhY2soKS5cbiAqXG4gKiAqKkhhbmRsZXIgZnVuY3Rpb25zKiogYXJlIGV4cG9ydGVkIGZyb20gYC4vaGFuZGxlcnMvYCBcdTIwMTQgc2VlIHJlZ2lzdGVyLWhhbmRsZXJzLnRzXG4gKiBmb3IgdGhlIGNvbXBsZXRlIHJlZ2lzdHJhdGlvbiBmbG93LlxuICovXG5leHBvcnQgeyBFc2NhbGF0ZUNhc2VBY3Rpb24sIENsb3NlQ2FzZUFjdGlvbiB9IGZyb20gJy4vY2FzZS5hY3Rpb25zJztcbmV4cG9ydCB7IE1hcmtQcmltYXJ5Q29udGFjdEFjdGlvbiwgU2VuZEVtYWlsQWN0aW9uIH0gZnJvbSAnLi9jb250YWN0LmFjdGlvbnMnO1xuZXhwb3J0IHsgTG9nQ2FsbEFjdGlvbiwgRXhwb3J0VG9Dc3ZBY3Rpb24gfSBmcm9tICcuL2dsb2JhbC5hY3Rpb25zJztcbmV4cG9ydCB7IENvbnZlcnRMZWFkQWN0aW9uLCBDcmVhdGVDYW1wYWlnbkFjdGlvbiB9IGZyb20gJy4vbGVhZC5hY3Rpb25zJztcbmV4cG9ydCB7IENsb25lT3Bwb3J0dW5pdHlBY3Rpb24sIE1hc3NVcGRhdGVTdGFnZUFjdGlvbiB9IGZyb20gJy4vb3Bwb3J0dW5pdHkuYWN0aW9ucyc7XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9hY3Rpb25zL2Nhc2UuYWN0aW9ucy50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9hY3Rpb25zXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2FjdGlvbnMvY2FzZS5hY3Rpb25zLnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5pbXBvcnQgdHlwZSB7IEFjdGlvbiB9IGZyb20gJ0BvYmplY3RzdGFjay9zcGVjL3VpJztcblxuLyoqIEVzY2FsYXRlIENhc2UgKi9cbmV4cG9ydCBjb25zdCBFc2NhbGF0ZUNhc2VBY3Rpb246IEFjdGlvbiA9IHtcbiAgbmFtZTogJ2VzY2FsYXRlX2Nhc2UnLFxuICBsYWJlbDogJ0VzY2FsYXRlIENhc2UnLFxuICBvYmplY3ROYW1lOiAnY2FzZScsXG4gIGljb246ICdhbGVydC10cmlhbmdsZScsXG4gIHR5cGU6ICdtb2RhbCcsXG4gIHRhcmdldDogJ2VzY2FsYXRlX2Nhc2VfbW9kYWwnLFxuICBsb2NhdGlvbnM6IFsncmVjb3JkX2hlYWRlcicsICdsaXN0X2l0ZW0nXSxcbiAgdmlzaWJsZTogJ2lzX2VzY2FsYXRlZCA9IGZhbHNlIEFORCBpc19jbG9zZWQgPSBmYWxzZScsXG4gIHBhcmFtczogW1xuICAgIHtcbiAgICAgIG5hbWU6ICdyZWFzb24nLFxuICAgICAgbGFiZWw6ICdFc2NhbGF0aW9uIFJlYXNvbicsXG4gICAgICB0eXBlOiAndGV4dGFyZWEnLFxuICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgfVxuICBdLFxuICBjb25maXJtVGV4dDogJ1RoaXMgd2lsbCBlc2NhbGF0ZSB0aGUgY2FzZSB0byB0aGUgZXNjYWxhdGlvbiB0ZWFtLiBDb250aW51ZT8nLFxuICBzdWNjZXNzTWVzc2FnZTogJ0Nhc2UgZXNjYWxhdGVkIHN1Y2Nlc3NmdWxseSEnLFxuICByZWZyZXNoQWZ0ZXI6IHRydWUsXG59O1xuXG4vKiogQ2xvc2UgQ2FzZSAqL1xuZXhwb3J0IGNvbnN0IENsb3NlQ2FzZUFjdGlvbjogQWN0aW9uID0ge1xuICBuYW1lOiAnY2xvc2VfY2FzZScsXG4gIGxhYmVsOiAnQ2xvc2UgQ2FzZScsXG4gIG9iamVjdE5hbWU6ICdjYXNlJyxcbiAgaWNvbjogJ2NoZWNrLWNpcmNsZScsXG4gIHR5cGU6ICdtb2RhbCcsXG4gIHRhcmdldDogJ2Nsb3NlX2Nhc2VfbW9kYWwnLFxuICBsb2NhdGlvbnM6IFsncmVjb3JkX2hlYWRlciddLFxuICB2aXNpYmxlOiAnaXNfY2xvc2VkID0gZmFsc2UnLFxuICBwYXJhbXM6IFtcbiAgICB7XG4gICAgICBuYW1lOiAncmVzb2x1dGlvbicsXG4gICAgICBsYWJlbDogJ1Jlc29sdXRpb24nLFxuICAgICAgdHlwZTogJ3RleHRhcmVhJyxcbiAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgIH1cbiAgXSxcbiAgY29uZmlybVRleHQ6ICdBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gY2xvc2UgdGhpcyBjYXNlPycsXG4gIHN1Y2Nlc3NNZXNzYWdlOiAnQ2FzZSBjbG9zZWQgc3VjY2Vzc2Z1bGx5IScsXG4gIHJlZnJlc2hBZnRlcjogdHJ1ZSxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9hY3Rpb25zL2NvbnRhY3QuYWN0aW9ucy50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9hY3Rpb25zXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2FjdGlvbnMvY29udGFjdC5hY3Rpb25zLnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5pbXBvcnQgdHlwZSB7IEFjdGlvbiB9IGZyb20gJ0BvYmplY3RzdGFjay9zcGVjL3VpJztcblxuLyoqIE1hcmsgQ29udGFjdCBhcyBQcmltYXJ5ICovXG5leHBvcnQgY29uc3QgTWFya1ByaW1hcnlDb250YWN0QWN0aW9uOiBBY3Rpb24gPSB7XG4gIG5hbWU6ICdtYXJrX3ByaW1hcnknLFxuICBsYWJlbDogJ01hcmsgYXMgUHJpbWFyeSBDb250YWN0JyxcbiAgb2JqZWN0TmFtZTogJ2NvbnRhY3QnLFxuICBpY29uOiAnc3RhcicsXG4gIHR5cGU6ICdzY3JpcHQnLFxuICB0YXJnZXQ6ICdtYXJrQXNQcmltYXJ5Q29udGFjdCcsXG4gIGxvY2F0aW9uczogWydyZWNvcmRfaGVhZGVyJywgJ2xpc3RfaXRlbSddLFxuICB2aXNpYmxlOiAnaXNfcHJpbWFyeSA9IGZhbHNlJyxcbiAgY29uZmlybVRleHQ6ICdNYXJrIHRoaXMgY29udGFjdCBhcyB0aGUgcHJpbWFyeSBjb250YWN0IGZvciB0aGUgYWNjb3VudD8nLFxuICBzdWNjZXNzTWVzc2FnZTogJ0NvbnRhY3QgbWFya2VkIGFzIHByaW1hcnkhJyxcbiAgcmVmcmVzaEFmdGVyOiB0cnVlLFxufTtcblxuLyoqIFNlbmQgRW1haWwgdG8gQ29udGFjdCAqL1xuZXhwb3J0IGNvbnN0IFNlbmRFbWFpbEFjdGlvbjogQWN0aW9uID0ge1xuICBuYW1lOiAnc2VuZF9lbWFpbCcsXG4gIGxhYmVsOiAnU2VuZCBFbWFpbCcsXG4gIG9iamVjdE5hbWU6ICdjb250YWN0JyxcbiAgaWNvbjogJ21haWwnLFxuICB0eXBlOiAnbW9kYWwnLFxuICB0YXJnZXQ6ICdlbWFpbF9jb21wb3NlcicsXG4gIGxvY2F0aW9uczogWydyZWNvcmRfaGVhZGVyJywgJ2xpc3RfaXRlbSddLFxuICB2aXNpYmxlOiAnZW1haWxfb3B0X291dCA9IGZhbHNlJyxcbiAgcmVmcmVzaEFmdGVyOiBmYWxzZSxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9hY3Rpb25zL2dsb2JhbC5hY3Rpb25zLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2FjdGlvbnNcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvYWN0aW9ucy9nbG9iYWwuYWN0aW9ucy50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuaW1wb3J0IHR5cGUgeyBBY3Rpb24gfSBmcm9tICdAb2JqZWN0c3RhY2svc3BlYy91aSc7XG5cbi8qKiBMb2cgYSBDYWxsICovXG5leHBvcnQgY29uc3QgTG9nQ2FsbEFjdGlvbjogQWN0aW9uID0ge1xuICBuYW1lOiAnbG9nX2NhbGwnLFxuICBsYWJlbDogJ0xvZyBhIENhbGwnLFxuICBpY29uOiAncGhvbmUnLFxuICB0eXBlOiAnbW9kYWwnLFxuICB0YXJnZXQ6ICdjYWxsX2xvZ19tb2RhbCcsXG4gIGxvY2F0aW9uczogWydyZWNvcmRfaGVhZGVyJywgJ2xpc3RfaXRlbScsICdyZWNvcmRfcmVsYXRlZCddLFxuICBwYXJhbXM6IFtcbiAgICB7XG4gICAgICBuYW1lOiAnc3ViamVjdCcsXG4gICAgICBsYWJlbDogJ0NhbGwgU3ViamVjdCcsXG4gICAgICB0eXBlOiAndGV4dCcsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICdkdXJhdGlvbicsXG4gICAgICBsYWJlbDogJ0R1cmF0aW9uIChtaW51dGVzKScsXG4gICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJ25vdGVzJyxcbiAgICAgIGxhYmVsOiAnQ2FsbCBOb3RlcycsXG4gICAgICB0eXBlOiAndGV4dGFyZWEnLFxuICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgIH1cbiAgXSxcbiAgc3VjY2Vzc01lc3NhZ2U6ICdDYWxsIGxvZ2dlZCBzdWNjZXNzZnVsbHkhJyxcbiAgcmVmcmVzaEFmdGVyOiB0cnVlLFxufTtcblxuLyoqIEV4cG9ydCB0byBDU1YgKi9cbmV4cG9ydCBjb25zdCBFeHBvcnRUb0NzdkFjdGlvbjogQWN0aW9uID0ge1xuICBuYW1lOiAnZXhwb3J0X2NzdicsXG4gIGxhYmVsOiAnRXhwb3J0IHRvIENTVicsXG4gIGljb246ICdkb3dubG9hZCcsXG4gIHR5cGU6ICdzY3JpcHQnLFxuICB0YXJnZXQ6ICdleHBvcnRUb0NTVicsXG4gIGxvY2F0aW9uczogWydsaXN0X3Rvb2xiYXInXSxcbiAgc3VjY2Vzc01lc3NhZ2U6ICdFeHBvcnQgY29tcGxldGVkIScsXG4gIHJlZnJlc2hBZnRlcjogZmFsc2UsXG59O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvYWN0aW9ucy9sZWFkLmFjdGlvbnMudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvYWN0aW9uc1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9hY3Rpb25zL2xlYWQuYWN0aW9ucy50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuaW1wb3J0IHR5cGUgeyBBY3Rpb24gfSBmcm9tICdAb2JqZWN0c3RhY2svc3BlYy91aSc7XG5cbi8qKiBDb252ZXJ0IExlYWQgdG8gQWNjb3VudCwgQ29udGFjdCwgYW5kIE9wcG9ydHVuaXR5ICovXG5leHBvcnQgY29uc3QgQ29udmVydExlYWRBY3Rpb246IEFjdGlvbiA9IHtcbiAgbmFtZTogJ2NvbnZlcnRfbGVhZCcsXG4gIGxhYmVsOiAnQ29udmVydCBMZWFkJyxcbiAgb2JqZWN0TmFtZTogJ2xlYWQnLFxuICBpY29uOiAnYXJyb3ctcmlnaHQtY2lyY2xlJyxcbiAgdHlwZTogJ2Zsb3cnLFxuICB0YXJnZXQ6ICdsZWFkX2NvbnZlcnNpb24nLFxuICBsb2NhdGlvbnM6IFsncmVjb3JkX2hlYWRlcicsICdsaXN0X2l0ZW0nXSxcbiAgdmlzaWJsZTogJ3N0YXR1cyA9IFwicXVhbGlmaWVkXCIgQU5EIGlzX2NvbnZlcnRlZCA9IGZhbHNlJyxcbiAgY29uZmlybVRleHQ6ICdBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gY29udmVydCB0aGlzIGxlYWQ/JyxcbiAgc3VjY2Vzc01lc3NhZ2U6ICdMZWFkIGNvbnZlcnRlZCBzdWNjZXNzZnVsbHkhJyxcbiAgcmVmcmVzaEFmdGVyOiB0cnVlLFxufTtcblxuLyoqIENyZWF0ZSBDYW1wYWlnbiBmcm9tIExlYWRzICovXG5leHBvcnQgY29uc3QgQ3JlYXRlQ2FtcGFpZ25BY3Rpb246IEFjdGlvbiA9IHtcbiAgbmFtZTogJ2NyZWF0ZV9jYW1wYWlnbicsXG4gIGxhYmVsOiAnQWRkIHRvIENhbXBhaWduJyxcbiAgb2JqZWN0TmFtZTogJ2xlYWQnLFxuICBpY29uOiAnc2VuZCcsXG4gIHR5cGU6ICdtb2RhbCcsXG4gIHRhcmdldDogJ2FkZF90b19jYW1wYWlnbl9tb2RhbCcsXG4gIGxvY2F0aW9uczogWydsaXN0X3Rvb2xiYXInXSxcbiAgcGFyYW1zOiBbXG4gICAge1xuICAgICAgbmFtZTogJ2NhbXBhaWduJyxcbiAgICAgIGxhYmVsOiAnQ2FtcGFpZ24nLFxuICAgICAgdHlwZTogJ2xvb2t1cCcsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICB9XG4gIF0sXG4gIHN1Y2Nlc3NNZXNzYWdlOiAnTGVhZHMgYWRkZWQgdG8gY2FtcGFpZ24hJyxcbiAgcmVmcmVzaEFmdGVyOiB0cnVlLFxufTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2FjdGlvbnMvb3Bwb3J0dW5pdHkuYWN0aW9ucy50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9hY3Rpb25zXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2FjdGlvbnMvb3Bwb3J0dW5pdHkuYWN0aW9ucy50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuaW1wb3J0IHR5cGUgeyBBY3Rpb24gfSBmcm9tICdAb2JqZWN0c3RhY2svc3BlYy91aSc7XG5cbi8qKiBDbG9uZSBPcHBvcnR1bml0eSAqL1xuZXhwb3J0IGNvbnN0IENsb25lT3Bwb3J0dW5pdHlBY3Rpb246IEFjdGlvbiA9IHtcbiAgbmFtZTogJ2Nsb25lX29wcG9ydHVuaXR5JyxcbiAgbGFiZWw6ICdDbG9uZSBPcHBvcnR1bml0eScsXG4gIG9iamVjdE5hbWU6ICdvcHBvcnR1bml0eScsXG4gIGljb246ICdjb3B5JyxcbiAgdHlwZTogJ3NjcmlwdCcsXG4gIHRhcmdldDogJ2Nsb25lUmVjb3JkJyxcbiAgbG9jYXRpb25zOiBbJ3JlY29yZF9oZWFkZXInLCAncmVjb3JkX21vcmUnXSxcbiAgc3VjY2Vzc01lc3NhZ2U6ICdPcHBvcnR1bml0eSBjbG9uZWQgc3VjY2Vzc2Z1bGx5IScsXG4gIHJlZnJlc2hBZnRlcjogdHJ1ZSxcbn07XG5cbi8qKiBNYXNzIFVwZGF0ZSBPcHBvcnR1bml0eSBTdGFnZSAqL1xuZXhwb3J0IGNvbnN0IE1hc3NVcGRhdGVTdGFnZUFjdGlvbjogQWN0aW9uID0ge1xuICBuYW1lOiAnbWFzc191cGRhdGVfc3RhZ2UnLFxuICBsYWJlbDogJ1VwZGF0ZSBTdGFnZScsXG4gIG9iamVjdE5hbWU6ICdvcHBvcnR1bml0eScsXG4gIGljb246ICdsYXllcnMnLFxuICB0eXBlOiAnbW9kYWwnLFxuICB0YXJnZXQ6ICdtYXNzX3VwZGF0ZV9zdGFnZV9tb2RhbCcsXG4gIGxvY2F0aW9uczogWydsaXN0X3Rvb2xiYXInXSxcbiAgcGFyYW1zOiBbXG4gICAge1xuICAgICAgbmFtZTogJ3N0YWdlJyxcbiAgICAgIGxhYmVsOiAnTmV3IFN0YWdlJyxcbiAgICAgIHR5cGU6ICdzZWxlY3QnLFxuICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICBvcHRpb25zOiBbXG4gICAgICAgIHsgbGFiZWw6ICdQcm9zcGVjdGluZycsIHZhbHVlOiAncHJvc3BlY3RpbmcnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdRdWFsaWZpY2F0aW9uJywgdmFsdWU6ICdxdWFsaWZpY2F0aW9uJyB9LFxuICAgICAgICB7IGxhYmVsOiAnTmVlZHMgQW5hbHlzaXMnLCB2YWx1ZTogJ25lZWRzX2FuYWx5c2lzJyB9LFxuICAgICAgICB7IGxhYmVsOiAnUHJvcG9zYWwnLCB2YWx1ZTogJ3Byb3Bvc2FsJyB9LFxuICAgICAgICB7IGxhYmVsOiAnTmVnb3RpYXRpb24nLCB2YWx1ZTogJ25lZ290aWF0aW9uJyB9LFxuICAgICAgICB7IGxhYmVsOiAnQ2xvc2VkIFdvbicsIHZhbHVlOiAnY2xvc2VkX3dvbicgfSxcbiAgICAgICAgeyBsYWJlbDogJ0Nsb3NlZCBMb3N0JywgdmFsdWU6ICdjbG9zZWRfbG9zdCcgfSxcbiAgICAgIF1cbiAgICB9XG4gIF0sXG4gIHN1Y2Nlc3NNZXNzYWdlOiAnT3Bwb3J0dW5pdGllcyB1cGRhdGVkIHN1Y2Nlc3NmdWxseSEnLFxuICByZWZyZXNoQWZ0ZXI6IHRydWUsXG59O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvZGFzaGJvYXJkcy9pbmRleC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9kYXNoYm9hcmRzXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2Rhc2hib2FyZHMvaW5kZXgudHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbi8qKlxuICogRGFzaGJvYXJkIERlZmluaXRpb25zIEJhcnJlbFxuICovXG5leHBvcnQgeyBFeGVjdXRpdmVEYXNoYm9hcmQgfSBmcm9tICcuL2V4ZWN1dGl2ZS5kYXNoYm9hcmQnO1xuZXhwb3J0IHsgU2FsZXNEYXNoYm9hcmQgfSBmcm9tICcuL3NhbGVzLmRhc2hib2FyZCc7XG5leHBvcnQgeyBTZXJ2aWNlRGFzaGJvYXJkIH0gZnJvbSAnLi9zZXJ2aWNlLmRhc2hib2FyZCc7XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9kYXNoYm9hcmRzL2V4ZWN1dGl2ZS5kYXNoYm9hcmQudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvZGFzaGJvYXJkc1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9kYXNoYm9hcmRzL2V4ZWN1dGl2ZS5kYXNoYm9hcmQudHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbmltcG9ydCB0eXBlIHsgRGFzaGJvYXJkIH0gZnJvbSAnQG9iamVjdHN0YWNrL3NwZWMvdWknO1xuXG5leHBvcnQgY29uc3QgRXhlY3V0aXZlRGFzaGJvYXJkOiBEYXNoYm9hcmQgPSB7XG4gIG5hbWU6ICdleGVjdXRpdmVfZGFzaGJvYXJkJyxcbiAgbGFiZWw6ICdFeGVjdXRpdmUgT3ZlcnZpZXcnLFxuICBkZXNjcmlwdGlvbjogJ0hpZ2gtbGV2ZWwgYnVzaW5lc3MgbWV0cmljcycsXG4gIFxuICB3aWRnZXRzOiBbXG4gICAgLy8gUm93IDE6IFJldmVudWUgTWV0cmljc1xuICAgIHtcbiAgICAgIGlkOiAndG90YWxfcmV2ZW51ZV95dGQnLFxuICAgICAgdGl0bGU6ICdUb3RhbCBSZXZlbnVlIChZVEQpJyxcbiAgICAgIHR5cGU6ICdtZXRyaWMnLFxuICAgICAgb2JqZWN0OiAnb3Bwb3J0dW5pdHknLFxuICAgICAgZmlsdGVyOiB7IHN0YWdlOiAnY2xvc2VkX3dvbicsIGNsb3NlX2RhdGU6IHsgJGd0ZTogJ3tjdXJyZW50X3llYXJfc3RhcnR9JyB9IH0sXG4gICAgICB2YWx1ZUZpZWxkOiAnYW1vdW50JyxcbiAgICAgIGFnZ3JlZ2F0ZTogJ3N1bScsXG4gICAgICBsYXlvdXQ6IHsgeDogMCwgeTogMCwgdzogMywgaDogMiB9LFxuICAgICAgb3B0aW9uczogeyBwcmVmaXg6ICckJywgY29sb3I6ICcjMDBBQTAwJyB9XG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ3RvdGFsX2FjY291bnRzJyxcbiAgICAgIHRpdGxlOiAnVG90YWwgQWNjb3VudHMnLFxuICAgICAgdHlwZTogJ21ldHJpYycsXG4gICAgICBvYmplY3Q6ICdhY2NvdW50JyxcbiAgICAgIGZpbHRlcjogeyBpc19hY3RpdmU6IHRydWUgfSxcbiAgICAgIGFnZ3JlZ2F0ZTogJ2NvdW50JyxcbiAgICAgIGxheW91dDogeyB4OiAzLCB5OiAwLCB3OiAzLCBoOiAyIH0sXG4gICAgICBvcHRpb25zOiB7IGNvbG9yOiAnIzQxNjlFMScgfVxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICd0b3RhbF9jb250YWN0cycsXG4gICAgICB0aXRsZTogJ1RvdGFsIENvbnRhY3RzJyxcbiAgICAgIHR5cGU6ICdtZXRyaWMnLFxuICAgICAgb2JqZWN0OiAnY29udGFjdCcsXG4gICAgICBhZ2dyZWdhdGU6ICdjb3VudCcsXG4gICAgICBsYXlvdXQ6IHsgeDogNiwgeTogMCwgdzogMywgaDogMiB9LFxuICAgICAgb3B0aW9uczogeyBjb2xvcjogJyM5MzcwREInIH1cbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAndG90YWxfbGVhZHMnLFxuICAgICAgdGl0bGU6ICdUb3RhbCBMZWFkcycsXG4gICAgICB0eXBlOiAnbWV0cmljJyxcbiAgICAgIG9iamVjdDogJ2xlYWQnLFxuICAgICAgZmlsdGVyOiB7IGlzX2NvbnZlcnRlZDogZmFsc2UgfSxcbiAgICAgIGFnZ3JlZ2F0ZTogJ2NvdW50JyxcbiAgICAgIGxheW91dDogeyB4OiA5LCB5OiAwLCB3OiAzLCBoOiAyIH0sXG4gICAgICBvcHRpb25zOiB7IGNvbG9yOiAnI0ZGQTUwMCcgfVxuICAgIH0sXG4gICAgXG4gICAgLy8gUm93IDI6IFJldmVudWUgQW5hbHlzaXNcbiAgICB7XG4gICAgICBpZDogJ3JldmVudWVfYnlfaW5kdXN0cnknLFxuICAgICAgdGl0bGU6ICdSZXZlbnVlIGJ5IEluZHVzdHJ5JyxcbiAgICAgIHR5cGU6ICdiYXInLFxuICAgICAgb2JqZWN0OiAnb3Bwb3J0dW5pdHknLFxuICAgICAgZmlsdGVyOiB7IHN0YWdlOiAnY2xvc2VkX3dvbicsIGNsb3NlX2RhdGU6IHsgJGd0ZTogJ3tjdXJyZW50X3llYXJfc3RhcnR9JyB9IH0sXG4gICAgICBjYXRlZ29yeUZpZWxkOiAnYWNjb3VudC5pbmR1c3RyeScsXG4gICAgICB2YWx1ZUZpZWxkOiAnYW1vdW50JyxcbiAgICAgIGFnZ3JlZ2F0ZTogJ3N1bScsXG4gICAgICBsYXlvdXQ6IHsgeDogMCwgeTogMiwgdzogNiwgaDogNCB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdxdWFydGVybHlfcmV2ZW51ZV90cmVuZCcsXG4gICAgICB0aXRsZTogJ1F1YXJ0ZXJseSBSZXZlbnVlIFRyZW5kJyxcbiAgICAgIHR5cGU6ICdsaW5lJyxcbiAgICAgIG9iamVjdDogJ29wcG9ydHVuaXR5JyxcbiAgICAgIGZpbHRlcjogeyBzdGFnZTogJ2Nsb3NlZF93b24nLCBjbG9zZV9kYXRlOiB7ICRndGU6ICd7bGFzdF80X3F1YXJ0ZXJzfScgfSB9LFxuICAgICAgY2F0ZWdvcnlGaWVsZDogJ2Nsb3NlX2RhdGUnLFxuICAgICAgdmFsdWVGaWVsZDogJ2Ftb3VudCcsXG4gICAgICBhZ2dyZWdhdGU6ICdzdW0nLFxuICAgICAgbGF5b3V0OiB7IHg6IDYsIHk6IDIsIHc6IDYsIGg6IDQgfSxcbiAgICAgIG9wdGlvbnM6IHsgZGF0ZUdyYW51bGFyaXR5OiAncXVhcnRlcicgfVxuICAgIH0sXG4gICAgXG4gICAgLy8gUm93IDM6IEN1c3RvbWVyICYgQWN0aXZpdHkgTWV0cmljc1xuICAgIHtcbiAgICAgIGlkOiAnbmV3X2FjY291bnRzX2J5X21vbnRoJyxcbiAgICAgIHRpdGxlOiAnTmV3IEFjY291bnRzIGJ5IE1vbnRoJyxcbiAgICAgIHR5cGU6ICdiYXInLFxuICAgICAgb2JqZWN0OiAnYWNjb3VudCcsXG4gICAgICBmaWx0ZXI6IHsgY3JlYXRlZF9kYXRlOiB7ICRndGU6ICd7bGFzdF82X21vbnRoc30nIH0gfSxcbiAgICAgIGNhdGVnb3J5RmllbGQ6ICdjcmVhdGVkX2RhdGUnLFxuICAgICAgYWdncmVnYXRlOiAnY291bnQnLFxuICAgICAgbGF5b3V0OiB7IHg6IDAsIHk6IDYsIHc6IDQsIGg6IDQgfSxcbiAgICAgIG9wdGlvbnM6IHsgZGF0ZUdyYW51bGFyaXR5OiAnbW9udGgnIH1cbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnbGVhZF9jb252ZXJzaW9uX3JhdGUnLFxuICAgICAgdGl0bGU6ICdMZWFkIENvbnZlcnNpb24gUmF0ZScsXG4gICAgICB0eXBlOiAnbWV0cmljJyxcbiAgICAgIG9iamVjdDogJ2xlYWQnLFxuICAgICAgdmFsdWVGaWVsZDogJ2lzX2NvbnZlcnRlZCcsXG4gICAgICBhZ2dyZWdhdGU6ICdhdmcnLFxuICAgICAgbGF5b3V0OiB7IHg6IDQsIHk6IDYsIHc6IDQsIGg6IDQgfSxcbiAgICAgIG9wdGlvbnM6IHsgc3VmZml4OiAnJScsIGNvbG9yOiAnIzAwQUEwMCcgfVxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICd0b3BfYWNjb3VudHNfYnlfcmV2ZW51ZScsXG4gICAgICB0aXRsZTogJ1RvcCBBY2NvdW50cyBieSBSZXZlbnVlJyxcbiAgICAgIHR5cGU6ICd0YWJsZScsXG4gICAgICBvYmplY3Q6ICdhY2NvdW50JyxcbiAgICAgIGFnZ3JlZ2F0ZTogJ2NvdW50JyxcbiAgICAgIGxheW91dDogeyB4OiA4LCB5OiA2LCB3OiA0LCBoOiA0IH0sXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGNvbHVtbnM6IFsnbmFtZScsICdhbm51YWxfcmV2ZW51ZScsICd0eXBlJ10sXG4gICAgICAgIHNvcnRCeTogJ2FubnVhbF9yZXZlbnVlJyxcbiAgICAgICAgc29ydE9yZGVyOiAnZGVzYycsXG4gICAgICAgIGxpbWl0OiAxMCxcbiAgICAgIH1cbiAgICB9LFxuICBdXG59O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvZGFzaGJvYXJkcy9zYWxlcy5kYXNoYm9hcmQudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvZGFzaGJvYXJkc1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9kYXNoYm9hcmRzL3NhbGVzLmRhc2hib2FyZC50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuaW1wb3J0IHR5cGUgeyBEYXNoYm9hcmQgfSBmcm9tICdAb2JqZWN0c3RhY2svc3BlYy91aSc7XG5cbmV4cG9ydCBjb25zdCBTYWxlc0Rhc2hib2FyZDogRGFzaGJvYXJkID0ge1xuICBuYW1lOiAnc2FsZXNfZGFzaGJvYXJkJyxcbiAgbGFiZWw6ICdTYWxlcyBQZXJmb3JtYW5jZScsXG4gIGRlc2NyaXB0aW9uOiAnS2V5IHNhbGVzIG1ldHJpY3MgYW5kIHBpcGVsaW5lIG92ZXJ2aWV3JyxcbiAgXG4gIHdpZGdldHM6IFtcbiAgICAvLyBSb3cgMTogS2V5IE1ldHJpY3NcbiAgICB7XG4gICAgICBpZDogJ3RvdGFsX3BpcGVsaW5lX3ZhbHVlJyxcbiAgICAgIHRpdGxlOiAnVG90YWwgUGlwZWxpbmUgVmFsdWUnLFxuICAgICAgdHlwZTogJ21ldHJpYycsXG4gICAgICBvYmplY3Q6ICdvcHBvcnR1bml0eScsXG4gICAgICBmaWx0ZXI6IHsgc3RhZ2U6IHsgJG5pbjogWydjbG9zZWRfd29uJywgJ2Nsb3NlZF9sb3N0J10gfSB9LFxuICAgICAgdmFsdWVGaWVsZDogJ2Ftb3VudCcsXG4gICAgICBhZ2dyZWdhdGU6ICdzdW0nLFxuICAgICAgbGF5b3V0OiB7IHg6IDAsIHk6IDAsIHc6IDMsIGg6IDIgfSxcbiAgICAgIG9wdGlvbnM6IHsgcHJlZml4OiAnJCcsIGNvbG9yOiAnIzQxNjlFMScgfVxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdjbG9zZWRfd29uX3RoaXNfcXVhcnRlcicsXG4gICAgICB0aXRsZTogJ0Nsb3NlZCBXb24gVGhpcyBRdWFydGVyJyxcbiAgICAgIHR5cGU6ICdtZXRyaWMnLFxuICAgICAgb2JqZWN0OiAnb3Bwb3J0dW5pdHknLFxuICAgICAgZmlsdGVyOiB7IHN0YWdlOiAnY2xvc2VkX3dvbicsIGNsb3NlX2RhdGU6IHsgJGd0ZTogJ3tjdXJyZW50X3F1YXJ0ZXJfc3RhcnR9JyB9IH0sXG4gICAgICB2YWx1ZUZpZWxkOiAnYW1vdW50JyxcbiAgICAgIGFnZ3JlZ2F0ZTogJ3N1bScsXG4gICAgICBsYXlvdXQ6IHsgeDogMywgeTogMCwgdzogMywgaDogMiB9LFxuICAgICAgb3B0aW9uczogeyBwcmVmaXg6ICckJywgY29sb3I6ICcjMDBBQTAwJyB9XG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ29wZW5fb3Bwb3J0dW5pdGllcycsXG4gICAgICB0aXRsZTogJ09wZW4gT3Bwb3J0dW5pdGllcycsXG4gICAgICB0eXBlOiAnbWV0cmljJyxcbiAgICAgIG9iamVjdDogJ29wcG9ydHVuaXR5JyxcbiAgICAgIGZpbHRlcjogeyBzdGFnZTogeyAkbmluOiBbJ2Nsb3NlZF93b24nLCAnY2xvc2VkX2xvc3QnXSB9IH0sXG4gICAgICBhZ2dyZWdhdGU6ICdjb3VudCcsXG4gICAgICBsYXlvdXQ6IHsgeDogNiwgeTogMCwgdzogMywgaDogMiB9LFxuICAgICAgb3B0aW9uczogeyBjb2xvcjogJyNGRkE1MDAnIH1cbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnd2luX3JhdGUnLFxuICAgICAgdGl0bGU6ICdXaW4gUmF0ZScsXG4gICAgICB0eXBlOiAnbWV0cmljJyxcbiAgICAgIG9iamVjdDogJ29wcG9ydHVuaXR5JyxcbiAgICAgIGZpbHRlcjogeyBjbG9zZV9kYXRlOiB7ICRndGU6ICd7Y3VycmVudF9xdWFydGVyX3N0YXJ0fScgfSB9LFxuICAgICAgdmFsdWVGaWVsZDogJ3N0YWdlJyxcbiAgICAgIGFnZ3JlZ2F0ZTogJ2NvdW50JyxcbiAgICAgIGxheW91dDogeyB4OiA5LCB5OiAwLCB3OiAzLCBoOiAyIH0sXG4gICAgICBvcHRpb25zOiB7IHN1ZmZpeDogJyUnLCBjb2xvcjogJyM5MzcwREInIH1cbiAgICB9LFxuICAgIFxuICAgIC8vIFJvdyAyOiBQaXBlbGluZSBBbmFseXNpc1xuICAgIHtcbiAgICAgIGlkOiAncGlwZWxpbmVfYnlfc3RhZ2UnLFxuICAgICAgdGl0bGU6ICdQaXBlbGluZSBieSBTdGFnZScsXG4gICAgICB0eXBlOiAnZnVubmVsJyxcbiAgICAgIG9iamVjdDogJ29wcG9ydHVuaXR5JyxcbiAgICAgIGZpbHRlcjogeyBzdGFnZTogeyAkbmluOiBbJ2Nsb3NlZF93b24nLCAnY2xvc2VkX2xvc3QnXSB9IH0sXG4gICAgICBjYXRlZ29yeUZpZWxkOiAnc3RhZ2UnLFxuICAgICAgdmFsdWVGaWVsZDogJ2Ftb3VudCcsXG4gICAgICBhZ2dyZWdhdGU6ICdzdW0nLFxuICAgICAgbGF5b3V0OiB7IHg6IDAsIHk6IDIsIHc6IDYsIGg6IDQgfSxcbiAgICAgIG9wdGlvbnM6IHsgc2hvd1ZhbHVlczogdHJ1ZSB9XG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ29wcG9ydHVuaXRpZXNfYnlfb3duZXInLFxuICAgICAgdGl0bGU6ICdPcHBvcnR1bml0aWVzIGJ5IE93bmVyJyxcbiAgICAgIHR5cGU6ICdiYXInLFxuICAgICAgb2JqZWN0OiAnb3Bwb3J0dW5pdHknLFxuICAgICAgZmlsdGVyOiB7IHN0YWdlOiB7ICRuaW46IFsnY2xvc2VkX3dvbicsICdjbG9zZWRfbG9zdCddIH0gfSxcbiAgICAgIGNhdGVnb3J5RmllbGQ6ICdvd25lcicsXG4gICAgICB2YWx1ZUZpZWxkOiAnYW1vdW50JyxcbiAgICAgIGFnZ3JlZ2F0ZTogJ3N1bScsXG4gICAgICBsYXlvdXQ6IHsgeDogNiwgeTogMiwgdzogNiwgaDogNCB9LFxuICAgICAgb3B0aW9uczogeyBob3Jpem9udGFsOiB0cnVlIH1cbiAgICB9LFxuICAgIFxuICAgIC8vIFJvdyAzOiBUcmVuZHNcbiAgICB7XG4gICAgICBpZDogJ21vbnRobHlfcmV2ZW51ZV90cmVuZCcsXG4gICAgICB0aXRsZTogJ01vbnRobHkgUmV2ZW51ZSBUcmVuZCcsXG4gICAgICB0eXBlOiAnbGluZScsXG4gICAgICBvYmplY3Q6ICdvcHBvcnR1bml0eScsXG4gICAgICBmaWx0ZXI6IHsgc3RhZ2U6ICdjbG9zZWRfd29uJywgY2xvc2VfZGF0ZTogeyAkZ3RlOiAne2xhc3RfMTJfbW9udGhzfScgfSB9LFxuICAgICAgY2F0ZWdvcnlGaWVsZDogJ2Nsb3NlX2RhdGUnLFxuICAgICAgdmFsdWVGaWVsZDogJ2Ftb3VudCcsXG4gICAgICBhZ2dyZWdhdGU6ICdzdW0nLFxuICAgICAgbGF5b3V0OiB7IHg6IDAsIHk6IDYsIHc6IDgsIGg6IDQgfSxcbiAgICAgIG9wdGlvbnM6IHsgZGF0ZUdyYW51bGFyaXR5OiAnbW9udGgnLCBzaG93VHJlbmQ6IHRydWUgfVxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICd0b3Bfb3Bwb3J0dW5pdGllcycsXG4gICAgICB0aXRsZTogJ1RvcCBPcHBvcnR1bml0aWVzJyxcbiAgICAgIHR5cGU6ICd0YWJsZScsXG4gICAgICBvYmplY3Q6ICdvcHBvcnR1bml0eScsXG4gICAgICBmaWx0ZXI6IHsgc3RhZ2U6IHsgJG5pbjogWydjbG9zZWRfd29uJywgJ2Nsb3NlZF9sb3N0J10gfSB9LFxuICAgICAgYWdncmVnYXRlOiAnY291bnQnLFxuICAgICAgbGF5b3V0OiB7IHg6IDgsIHk6IDYsIHc6IDQsIGg6IDQgfSxcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgY29sdW1uczogWyduYW1lJywgJ2Ftb3VudCcsICdzdGFnZScsICdjbG9zZV9kYXRlJ10sXG4gICAgICAgIHNvcnRCeTogJ2Ftb3VudCcsXG4gICAgICAgIHNvcnRPcmRlcjogJ2Rlc2MnLFxuICAgICAgICBsaW1pdDogMTAsXG4gICAgICB9XG4gICAgfSxcbiAgXVxufTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2Rhc2hib2FyZHMvc2VydmljZS5kYXNoYm9hcmQudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvZGFzaGJvYXJkc1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9kYXNoYm9hcmRzL3NlcnZpY2UuZGFzaGJvYXJkLnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5pbXBvcnQgdHlwZSB7IERhc2hib2FyZCB9IGZyb20gJ0BvYmplY3RzdGFjay9zcGVjL3VpJztcblxuZXhwb3J0IGNvbnN0IFNlcnZpY2VEYXNoYm9hcmQ6IERhc2hib2FyZCA9IHtcbiAgbmFtZTogJ3NlcnZpY2VfZGFzaGJvYXJkJyxcbiAgbGFiZWw6ICdDdXN0b21lciBTZXJ2aWNlJyxcbiAgZGVzY3JpcHRpb246ICdTdXBwb3J0IGNhc2UgbWV0cmljcyBhbmQgcGVyZm9ybWFuY2UnLFxuICBcbiAgd2lkZ2V0czogW1xuICAgIC8vIFJvdyAxOiBLZXkgTWV0cmljc1xuICAgIHtcbiAgICAgIGlkOiAnb3Blbl9jYXNlcycsXG4gICAgICB0aXRsZTogJ09wZW4gQ2FzZXMnLFxuICAgICAgdHlwZTogJ21ldHJpYycsXG4gICAgICBvYmplY3Q6ICdjYXNlJyxcbiAgICAgIGZpbHRlcjogeyBpc19jbG9zZWQ6IGZhbHNlIH0sXG4gICAgICBhZ2dyZWdhdGU6ICdjb3VudCcsXG4gICAgICBsYXlvdXQ6IHsgeDogMCwgeTogMCwgdzogMywgaDogMiB9LFxuICAgICAgb3B0aW9uczogeyBjb2xvcjogJyNGRkE1MDAnIH1cbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnY3JpdGljYWxfY2FzZXMnLFxuICAgICAgdGl0bGU6ICdDcml0aWNhbCBDYXNlcycsXG4gICAgICB0eXBlOiAnbWV0cmljJyxcbiAgICAgIG9iamVjdDogJ2Nhc2UnLFxuICAgICAgZmlsdGVyOiB7IHByaW9yaXR5OiAnY3JpdGljYWwnLCBpc19jbG9zZWQ6IGZhbHNlIH0sXG4gICAgICBhZ2dyZWdhdGU6ICdjb3VudCcsXG4gICAgICBsYXlvdXQ6IHsgeDogMywgeTogMCwgdzogMywgaDogMiB9LFxuICAgICAgb3B0aW9uczogeyBjb2xvcjogJyNGRjAwMDAnIH1cbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnYXZnX3Jlc29sdXRpb25fdGltZScsXG4gICAgICB0aXRsZTogJ0F2ZyBSZXNvbHV0aW9uIFRpbWUgKGhycyknLFxuICAgICAgdHlwZTogJ21ldHJpYycsXG4gICAgICBvYmplY3Q6ICdjYXNlJyxcbiAgICAgIGZpbHRlcjogeyBpc19jbG9zZWQ6IHRydWUgfSxcbiAgICAgIHZhbHVlRmllbGQ6ICdyZXNvbHV0aW9uX3RpbWVfaG91cnMnLFxuICAgICAgYWdncmVnYXRlOiAnYXZnJyxcbiAgICAgIGxheW91dDogeyB4OiA2LCB5OiAwLCB3OiAzLCBoOiAyIH0sXG4gICAgICBvcHRpb25zOiB7IHN1ZmZpeDogJ2gnLCBjb2xvcjogJyM0MTY5RTEnIH1cbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnc2xhX3Zpb2xhdGlvbnMnLFxuICAgICAgdGl0bGU6ICdTTEEgVmlvbGF0aW9ucycsXG4gICAgICB0eXBlOiAnbWV0cmljJyxcbiAgICAgIG9iamVjdDogJ2Nhc2UnLFxuICAgICAgZmlsdGVyOiB7IGlzX3NsYV92aW9sYXRlZDogdHJ1ZSB9LFxuICAgICAgYWdncmVnYXRlOiAnY291bnQnLFxuICAgICAgbGF5b3V0OiB7IHg6IDksIHk6IDAsIHc6IDMsIGg6IDIgfSxcbiAgICAgIG9wdGlvbnM6IHsgY29sb3I6ICcjRkY0NTAwJyB9XG4gICAgfSxcbiAgICBcbiAgICAvLyBSb3cgMjogQ2FzZSBEaXN0cmlidXRpb25cbiAgICB7XG4gICAgICBpZDogJ2Nhc2VzX2J5X3N0YXR1cycsXG4gICAgICB0aXRsZTogJ0Nhc2VzIGJ5IFN0YXR1cycsXG4gICAgICB0eXBlOiAncGllJyxcbiAgICAgIG9iamVjdDogJ2Nhc2UnLFxuICAgICAgZmlsdGVyOiB7IGlzX2Nsb3NlZDogZmFsc2UgfSxcbiAgICAgIGNhdGVnb3J5RmllbGQ6ICdzdGF0dXMnLFxuICAgICAgYWdncmVnYXRlOiAnY291bnQnLFxuICAgICAgbGF5b3V0OiB7IHg6IDAsIHk6IDIsIHc6IDQsIGg6IDQgfSxcbiAgICAgIG9wdGlvbnM6IHsgc2hvd0xlZ2VuZDogdHJ1ZSB9XG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2Nhc2VzX2J5X3ByaW9yaXR5JyxcbiAgICAgIHRpdGxlOiAnQ2FzZXMgYnkgUHJpb3JpdHknLFxuICAgICAgdHlwZTogJ3BpZScsXG4gICAgICBvYmplY3Q6ICdjYXNlJyxcbiAgICAgIGZpbHRlcjogeyBpc19jbG9zZWQ6IGZhbHNlIH0sXG4gICAgICBjYXRlZ29yeUZpZWxkOiAncHJpb3JpdHknLFxuICAgICAgYWdncmVnYXRlOiAnY291bnQnLFxuICAgICAgbGF5b3V0OiB7IHg6IDQsIHk6IDIsIHc6IDQsIGg6IDQgfSxcbiAgICAgIG9wdGlvbnM6IHsgc2hvd0xlZ2VuZDogdHJ1ZSB9XG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2Nhc2VzX2J5X29yaWdpbicsXG4gICAgICB0aXRsZTogJ0Nhc2VzIGJ5IE9yaWdpbicsXG4gICAgICB0eXBlOiAnYmFyJyxcbiAgICAgIG9iamVjdDogJ2Nhc2UnLFxuICAgICAgY2F0ZWdvcnlGaWVsZDogJ29yaWdpbicsXG4gICAgICBhZ2dyZWdhdGU6ICdjb3VudCcsXG4gICAgICBsYXlvdXQ6IHsgeDogOCwgeTogMiwgdzogNCwgaDogNCB9LFxuICAgIH0sXG4gICAgXG4gICAgLy8gUm93IDM6IFRyZW5kcyBhbmQgTGlzdHNcbiAgICB7XG4gICAgICBpZDogJ2RhaWx5X2Nhc2Vfdm9sdW1lJyxcbiAgICAgIHRpdGxlOiAnRGFpbHkgQ2FzZSBWb2x1bWUnLFxuICAgICAgdHlwZTogJ2xpbmUnLFxuICAgICAgb2JqZWN0OiAnY2FzZScsXG4gICAgICBmaWx0ZXI6IHsgY3JlYXRlZF9kYXRlOiB7ICRndGU6ICd7bGFzdF8zMF9kYXlzfScgfSB9LFxuICAgICAgY2F0ZWdvcnlGaWVsZDogJ2NyZWF0ZWRfZGF0ZScsXG4gICAgICBhZ2dyZWdhdGU6ICdjb3VudCcsXG4gICAgICBsYXlvdXQ6IHsgeDogMCwgeTogNiwgdzogOCwgaDogNCB9LFxuICAgICAgb3B0aW9uczogeyBkYXRlR3JhbnVsYXJpdHk6ICdkYXknIH1cbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnbXlfb3Blbl9jYXNlcycsXG4gICAgICB0aXRsZTogJ015IE9wZW4gQ2FzZXMnLFxuICAgICAgdHlwZTogJ3RhYmxlJyxcbiAgICAgIG9iamVjdDogJ2Nhc2UnLFxuICAgICAgZmlsdGVyOiB7IG93bmVyOiAne2N1cnJlbnRfdXNlcn0nLCBpc19jbG9zZWQ6IGZhbHNlIH0sXG4gICAgICBhZ2dyZWdhdGU6ICdjb3VudCcsXG4gICAgICBsYXlvdXQ6IHsgeDogOCwgeTogNiwgdzogNCwgaDogNCB9LFxuICAgICAgb3B0aW9uczoge1xuICAgICAgICBjb2x1bW5zOiBbJ2Nhc2VfbnVtYmVyJywgJ3N1YmplY3QnLCAncHJpb3JpdHknLCAnc3RhdHVzJ10sXG4gICAgICAgIHNvcnRCeTogJ3ByaW9yaXR5JyxcbiAgICAgICAgc29ydE9yZGVyOiAnZGVzYycsXG4gICAgICAgIGxpbWl0OiAxMCxcbiAgICAgIH1cbiAgICB9LFxuICBdXG59O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvcmVwb3J0cy9pbmRleC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9yZXBvcnRzXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3JlcG9ydHMvaW5kZXgudHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbi8qKlxuICogUmVwb3J0IERlZmluaXRpb25zIEJhcnJlbFxuICovXG5leHBvcnQgeyBBY2NvdW50c0J5SW5kdXN0cnlUeXBlUmVwb3J0IH0gZnJvbSAnLi9hY2NvdW50LnJlcG9ydCc7XG5leHBvcnQgeyBDYXNlc0J5U3RhdHVzUHJpb3JpdHlSZXBvcnQsIFNsYVBlcmZvcm1hbmNlUmVwb3J0IH0gZnJvbSAnLi9jYXNlLnJlcG9ydCc7XG5leHBvcnQgeyBDb250YWN0c0J5QWNjb3VudFJlcG9ydCB9IGZyb20gJy4vY29udGFjdC5yZXBvcnQnO1xuZXhwb3J0IHsgTGVhZHNCeVNvdXJjZVJlcG9ydCB9IGZyb20gJy4vbGVhZC5yZXBvcnQnO1xuZXhwb3J0IHsgT3Bwb3J0dW5pdGllc0J5U3RhZ2VSZXBvcnQsIFdvbk9wcG9ydHVuaXRpZXNCeU93bmVyUmVwb3J0IH0gZnJvbSAnLi9vcHBvcnR1bml0eS5yZXBvcnQnO1xuZXhwb3J0IHsgVGFza3NCeU93bmVyUmVwb3J0IH0gZnJvbSAnLi90YXNrLnJlcG9ydCc7XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9yZXBvcnRzL2FjY291bnQucmVwb3J0LnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3JlcG9ydHNcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvcmVwb3J0cy9hY2NvdW50LnJlcG9ydC50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuaW1wb3J0IHR5cGUgeyBSZXBvcnRJbnB1dCB9IGZyb20gJ0BvYmplY3RzdGFjay9zcGVjL3VpJztcblxuZXhwb3J0IGNvbnN0IEFjY291bnRzQnlJbmR1c3RyeVR5cGVSZXBvcnQ6IFJlcG9ydElucHV0ID0ge1xuICBuYW1lOiAnYWNjb3VudHNfYnlfaW5kdXN0cnlfdHlwZScsXG4gIGxhYmVsOiAnQWNjb3VudHMgYnkgSW5kdXN0cnkgYW5kIFR5cGUnLFxuICBkZXNjcmlwdGlvbjogJ01hdHJpeCByZXBvcnQgc2hvd2luZyBhY2NvdW50cyBieSBpbmR1c3RyeSBhbmQgdHlwZScsXG4gIG9iamVjdE5hbWU6ICdhY2NvdW50JyxcbiAgdHlwZTogJ21hdHJpeCcsXG4gIGNvbHVtbnM6IFtcbiAgICB7IGZpZWxkOiAnbmFtZScsIGFnZ3JlZ2F0ZTogJ2NvdW50JyB9LFxuICAgIHsgZmllbGQ6ICdhbm51YWxfcmV2ZW51ZScsIGFnZ3JlZ2F0ZTogJ3N1bScgfSxcbiAgXSxcbiAgZ3JvdXBpbmdzRG93bjogW3sgZmllbGQ6ICdpbmR1c3RyeScsIHNvcnRPcmRlcjogJ2FzYycgfV0sXG4gIGdyb3VwaW5nc0Fjcm9zczogW3sgZmllbGQ6ICd0eXBlJywgc29ydE9yZGVyOiAnYXNjJyB9XSxcbiAgZmlsdGVyOiB7IGlzX2FjdGl2ZTogdHJ1ZSB9LFxufTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3JlcG9ydHMvY2FzZS5yZXBvcnQudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvcmVwb3J0c1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9yZXBvcnRzL2Nhc2UucmVwb3J0LnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5pbXBvcnQgdHlwZSB7IFJlcG9ydElucHV0IH0gZnJvbSAnQG9iamVjdHN0YWNrL3NwZWMvdWknO1xuXG5leHBvcnQgY29uc3QgQ2FzZXNCeVN0YXR1c1ByaW9yaXR5UmVwb3J0OiBSZXBvcnRJbnB1dCA9IHtcbiAgbmFtZTogJ2Nhc2VzX2J5X3N0YXR1c19wcmlvcml0eScsXG4gIGxhYmVsOiAnQ2FzZXMgYnkgU3RhdHVzIGFuZCBQcmlvcml0eScsXG4gIGRlc2NyaXB0aW9uOiAnU3VtbWFyeSBvZiBjYXNlcyBieSBzdGF0dXMgYW5kIHByaW9yaXR5JyxcbiAgb2JqZWN0TmFtZTogJ2Nhc2UnLFxuICB0eXBlOiAnc3VtbWFyeScsXG4gIGNvbHVtbnM6IFtcbiAgICB7IGZpZWxkOiAnY2FzZV9udW1iZXInLCBsYWJlbDogJ0Nhc2UgTnVtYmVyJyB9LFxuICAgIHsgZmllbGQ6ICdzdWJqZWN0JywgbGFiZWw6ICdTdWJqZWN0JyB9LFxuICAgIHsgZmllbGQ6ICdhY2NvdW50JywgbGFiZWw6ICdBY2NvdW50JyB9LFxuICAgIHsgZmllbGQ6ICdvd25lcicsIGxhYmVsOiAnT3duZXInIH0sXG4gICAgeyBmaWVsZDogJ3Jlc29sdXRpb25fdGltZV9ob3VycycsIGxhYmVsOiAnUmVzb2x1dGlvbiBUaW1lJywgYWdncmVnYXRlOiAnYXZnJyB9LFxuICBdLFxuICBncm91cGluZ3NEb3duOiBbXG4gICAgeyBmaWVsZDogJ3N0YXR1cycsIHNvcnRPcmRlcjogJ2FzYycgfSxcbiAgICB7IGZpZWxkOiAncHJpb3JpdHknLCBzb3J0T3JkZXI6ICdkZXNjJyB9LFxuICBdLFxuICBjaGFydDogeyB0eXBlOiAnYmFyJywgdGl0bGU6ICdDYXNlcyBieSBTdGF0dXMnLCBzaG93TGVnZW5kOiB0cnVlLCB4QXhpczogJ3N0YXR1cycsIHlBeGlzOiAnY2FzZV9udW1iZXInIH1cbn07XG5cbmV4cG9ydCBjb25zdCBTbGFQZXJmb3JtYW5jZVJlcG9ydDogUmVwb3J0SW5wdXQgPSB7XG4gIG5hbWU6ICdzbGFfcGVyZm9ybWFuY2UnLFxuICBsYWJlbDogJ1NMQSBQZXJmb3JtYW5jZSBSZXBvcnQnLFxuICBkZXNjcmlwdGlvbjogJ0FuYWx5c2lzIG9mIFNMQSBjb21wbGlhbmNlJyxcbiAgb2JqZWN0TmFtZTogJ2Nhc2UnLFxuICB0eXBlOiAnc3VtbWFyeScsXG4gIGNvbHVtbnM6IFtcbiAgICB7IGZpZWxkOiAnY2FzZV9udW1iZXInLCBhZ2dyZWdhdGU6ICdjb3VudCcgfSxcbiAgICB7IGZpZWxkOiAnaXNfc2xhX3Zpb2xhdGVkJywgbGFiZWw6ICdTTEEgVmlvbGF0ZWQnLCBhZ2dyZWdhdGU6ICdjb3VudCcgfSxcbiAgICB7IGZpZWxkOiAncmVzb2x1dGlvbl90aW1lX2hvdXJzJywgbGFiZWw6ICdBdmcgUmVzb2x1dGlvbiBUaW1lJywgYWdncmVnYXRlOiAnYXZnJyB9LFxuICBdLFxuICBncm91cGluZ3NEb3duOiBbeyBmaWVsZDogJ3ByaW9yaXR5Jywgc29ydE9yZGVyOiAnZGVzYycgfV0sXG4gIGZpbHRlcjogeyBpc19jbG9zZWQ6IHRydWUgfSxcbiAgY2hhcnQ6IHsgdHlwZTogJ2NvbHVtbicsIHRpdGxlOiAnU0xBIFZpb2xhdGlvbnMgYnkgUHJpb3JpdHknLCBzaG93TGVnZW5kOiBmYWxzZSwgeEF4aXM6ICdwcmlvcml0eScsIHlBeGlzOiAnaXNfc2xhX3Zpb2xhdGVkJyB9XG59O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvcmVwb3J0cy9jb250YWN0LnJlcG9ydC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9yZXBvcnRzXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3JlcG9ydHMvY29udGFjdC5yZXBvcnQudHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbmltcG9ydCB0eXBlIHsgUmVwb3J0SW5wdXQgfSBmcm9tICdAb2JqZWN0c3RhY2svc3BlYy91aSc7XG5cbmV4cG9ydCBjb25zdCBDb250YWN0c0J5QWNjb3VudFJlcG9ydDogUmVwb3J0SW5wdXQgPSB7XG4gIG5hbWU6ICdjb250YWN0c19ieV9hY2NvdW50JyxcbiAgbGFiZWw6ICdDb250YWN0cyBieSBBY2NvdW50JyxcbiAgZGVzY3JpcHRpb246ICdMaXN0IG9mIGNvbnRhY3RzIGdyb3VwZWQgYnkgYWNjb3VudCcsXG4gIG9iamVjdE5hbWU6ICdjb250YWN0JyxcbiAgdHlwZTogJ3N1bW1hcnknLFxuICBjb2x1bW5zOiBbXG4gICAgeyBmaWVsZDogJ2Z1bGxfbmFtZScsIGxhYmVsOiAnTmFtZScgfSxcbiAgICB7IGZpZWxkOiAndGl0bGUnLCBsYWJlbDogJ1RpdGxlJyB9LFxuICAgIHsgZmllbGQ6ICdlbWFpbCcsIGxhYmVsOiAnRW1haWwnIH0sXG4gICAgeyBmaWVsZDogJ3Bob25lJywgbGFiZWw6ICdQaG9uZScgfSxcbiAgICB7IGZpZWxkOiAnaXNfcHJpbWFyeScsIGxhYmVsOiAnUHJpbWFyeSBDb250YWN0JyB9LFxuICBdLFxuICBncm91cGluZ3NEb3duOiBbeyBmaWVsZDogJ2FjY291bnQnLCBzb3J0T3JkZXI6ICdhc2MnIH1dLFxufTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3JlcG9ydHMvbGVhZC5yZXBvcnQudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvcmVwb3J0c1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9yZXBvcnRzL2xlYWQucmVwb3J0LnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5pbXBvcnQgdHlwZSB7IFJlcG9ydElucHV0IH0gZnJvbSAnQG9iamVjdHN0YWNrL3NwZWMvdWknO1xuXG5leHBvcnQgY29uc3QgTGVhZHNCeVNvdXJjZVJlcG9ydDogUmVwb3J0SW5wdXQgPSB7XG4gIG5hbWU6ICdsZWFkc19ieV9zb3VyY2UnLFxuICBsYWJlbDogJ0xlYWRzIGJ5IFNvdXJjZSBhbmQgU3RhdHVzJyxcbiAgZGVzY3JpcHRpb246ICdMZWFkIHBpcGVsaW5lIGFuYWx5c2lzJyxcbiAgb2JqZWN0TmFtZTogJ2xlYWQnLFxuICB0eXBlOiAnc3VtbWFyeScsXG4gIGNvbHVtbnM6IFtcbiAgICB7IGZpZWxkOiAnZnVsbF9uYW1lJywgbGFiZWw6ICdOYW1lJyB9LFxuICAgIHsgZmllbGQ6ICdjb21wYW55JywgbGFiZWw6ICdDb21wYW55JyB9LFxuICAgIHsgZmllbGQ6ICdyYXRpbmcnLCBsYWJlbDogJ1JhdGluZycgfSxcbiAgXSxcbiAgZ3JvdXBpbmdzRG93bjogW1xuICAgIHsgZmllbGQ6ICdsZWFkX3NvdXJjZScsIHNvcnRPcmRlcjogJ2FzYycgfSxcbiAgICB7IGZpZWxkOiAnc3RhdHVzJywgc29ydE9yZGVyOiAnYXNjJyB9LFxuICBdLFxuICBmaWx0ZXI6IHsgaXNfY29udmVydGVkOiBmYWxzZSB9LFxuICBjaGFydDogeyB0eXBlOiAncGllJywgdGl0bGU6ICdMZWFkcyBieSBTb3VyY2UnLCBzaG93TGVnZW5kOiB0cnVlLCB4QXhpczogJ2xlYWRfc291cmNlJywgeUF4aXM6ICdmdWxsX25hbWUnIH1cbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9yZXBvcnRzL29wcG9ydHVuaXR5LnJlcG9ydC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9yZXBvcnRzXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3JlcG9ydHMvb3Bwb3J0dW5pdHkucmVwb3J0LnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5pbXBvcnQgdHlwZSB7IFJlcG9ydElucHV0IH0gZnJvbSAnQG9iamVjdHN0YWNrL3NwZWMvdWknO1xuXG5leHBvcnQgY29uc3QgT3Bwb3J0dW5pdGllc0J5U3RhZ2VSZXBvcnQ6IFJlcG9ydElucHV0ID0ge1xuICBuYW1lOiAnb3Bwb3J0dW5pdGllc19ieV9zdGFnZScsXG4gIGxhYmVsOiAnT3Bwb3J0dW5pdGllcyBieSBTdGFnZScsXG4gIGRlc2NyaXB0aW9uOiAnU3VtbWFyeSBvZiBvcHBvcnR1bml0aWVzIGdyb3VwZWQgYnkgc3RhZ2UnLFxuICBvYmplY3ROYW1lOiAnb3Bwb3J0dW5pdHknLFxuICB0eXBlOiAnc3VtbWFyeScsXG4gIGNvbHVtbnM6IFtcbiAgICB7IGZpZWxkOiAnbmFtZScsIGxhYmVsOiAnT3Bwb3J0dW5pdHkgTmFtZScgfSxcbiAgICB7IGZpZWxkOiAnYWNjb3VudCcsIGxhYmVsOiAnQWNjb3VudCcgfSxcbiAgICB7IGZpZWxkOiAnYW1vdW50JywgbGFiZWw6ICdBbW91bnQnLCBhZ2dyZWdhdGU6ICdzdW0nIH0sXG4gICAgeyBmaWVsZDogJ2Nsb3NlX2RhdGUnLCBsYWJlbDogJ0Nsb3NlIERhdGUnIH0sXG4gICAgeyBmaWVsZDogJ3Byb2JhYmlsaXR5JywgbGFiZWw6ICdQcm9iYWJpbGl0eScsIGFnZ3JlZ2F0ZTogJ2F2ZycgfSxcbiAgXSxcbiAgZ3JvdXBpbmdzRG93bjogW3sgZmllbGQ6ICdzdGFnZScsIHNvcnRPcmRlcjogJ2FzYycgfV0sXG4gIGZpbHRlcjogeyBzdGFnZTogeyAkbmU6ICdjbG9zZWRfbG9zdCcgfSwgY2xvc2VfZGF0ZTogeyAkZ3RlOiAne2N1cnJlbnRfeWVhcl9zdGFydH0nIH0gfSxcbiAgY2hhcnQ6IHsgdHlwZTogJ2JhcicsIHRpdGxlOiAnUGlwZWxpbmUgYnkgU3RhZ2UnLCBzaG93TGVnZW5kOiB0cnVlLCB4QXhpczogJ3N0YWdlJywgeUF4aXM6ICdhbW91bnQnIH1cbn07XG5cbmV4cG9ydCBjb25zdCBXb25PcHBvcnR1bml0aWVzQnlPd25lclJlcG9ydDogUmVwb3J0SW5wdXQgPSB7XG4gIG5hbWU6ICd3b25fb3Bwb3J0dW5pdGllc19ieV9vd25lcicsXG4gIGxhYmVsOiAnV29uIE9wcG9ydHVuaXRpZXMgYnkgT3duZXInLFxuICBkZXNjcmlwdGlvbjogJ0Nsb3NlZCB3b24gb3Bwb3J0dW5pdGllcyBncm91cGVkIGJ5IG93bmVyJyxcbiAgb2JqZWN0TmFtZTogJ29wcG9ydHVuaXR5JyxcbiAgdHlwZTogJ3N1bW1hcnknLFxuICBjb2x1bW5zOiBbXG4gICAgeyBmaWVsZDogJ25hbWUnLCBsYWJlbDogJ09wcG9ydHVuaXR5IE5hbWUnIH0sXG4gICAgeyBmaWVsZDogJ2FjY291bnQnLCBsYWJlbDogJ0FjY291bnQnIH0sXG4gICAgeyBmaWVsZDogJ2Ftb3VudCcsIGxhYmVsOiAnQW1vdW50JywgYWdncmVnYXRlOiAnc3VtJyB9LFxuICAgIHsgZmllbGQ6ICdjbG9zZV9kYXRlJywgbGFiZWw6ICdDbG9zZSBEYXRlJyB9LFxuICBdLFxuICBncm91cGluZ3NEb3duOiBbeyBmaWVsZDogJ293bmVyJywgc29ydE9yZGVyOiAnZGVzYycgfV0sXG4gIGZpbHRlcjogeyBzdGFnZTogJ2Nsb3NlZF93b24nIH0sXG4gIGNoYXJ0OiB7IHR5cGU6ICdjb2x1bW4nLCB0aXRsZTogJ1JldmVudWUgYnkgU2FsZXMgUmVwJywgc2hvd0xlZ2VuZDogZmFsc2UsIHhBeGlzOiAnb3duZXInLCB5QXhpczogJ2Ftb3VudCcgfVxufTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3JlcG9ydHMvdGFzay5yZXBvcnQudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvcmVwb3J0c1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9yZXBvcnRzL3Rhc2sucmVwb3J0LnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5pbXBvcnQgdHlwZSB7IFJlcG9ydElucHV0IH0gZnJvbSAnQG9iamVjdHN0YWNrL3NwZWMvdWknO1xuXG5leHBvcnQgY29uc3QgVGFza3NCeU93bmVyUmVwb3J0OiBSZXBvcnRJbnB1dCA9IHtcbiAgbmFtZTogJ3Rhc2tzX2J5X293bmVyJyxcbiAgbGFiZWw6ICdUYXNrcyBieSBPd25lcicsXG4gIGRlc2NyaXB0aW9uOiAnVGFzayBzdW1tYXJ5IGJ5IG93bmVyJyxcbiAgb2JqZWN0TmFtZTogJ3Rhc2snLFxuICB0eXBlOiAnc3VtbWFyeScsXG4gIGNvbHVtbnM6IFtcbiAgICB7IGZpZWxkOiAnc3ViamVjdCcsIGxhYmVsOiAnU3ViamVjdCcgfSxcbiAgICB7IGZpZWxkOiAnc3RhdHVzJywgbGFiZWw6ICdTdGF0dXMnIH0sXG4gICAgeyBmaWVsZDogJ3ByaW9yaXR5JywgbGFiZWw6ICdQcmlvcml0eScgfSxcbiAgICB7IGZpZWxkOiAnZHVlX2RhdGUnLCBsYWJlbDogJ0R1ZSBEYXRlJyB9LFxuICAgIHsgZmllbGQ6ICdhY3R1YWxfaG91cnMnLCBsYWJlbDogJ0hvdXJzJywgYWdncmVnYXRlOiAnc3VtJyB9LFxuICBdLFxuICBncm91cGluZ3NEb3duOiBbeyBmaWVsZDogJ293bmVyJywgc29ydE9yZGVyOiAnYXNjJyB9XSxcbiAgZmlsdGVyOiB7IGlzX2NvbXBsZXRlZDogZmFsc2UgfSxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9mbG93cy9pbmRleC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9mbG93c1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9mbG93cy9pbmRleC50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuLyoqXG4gKiBGbG93IERlZmluaXRpb25zIEJhcnJlbFxuICovXG5leHBvcnQgeyBDYW1wYWlnbkVucm9sbG1lbnRGbG93IH0gZnJvbSAnLi9jYW1wYWlnbi1lbnJvbGxtZW50LmZsb3cnO1xuZXhwb3J0IHsgQ2FzZUVzY2FsYXRpb25GbG93IH0gZnJvbSAnLi9jYXNlLWVzY2FsYXRpb24uZmxvdyc7XG5leHBvcnQgeyBMZWFkQ29udmVyc2lvbkZsb3cgfSBmcm9tICcuL2xlYWQtY29udmVyc2lvbi5mbG93JztcbmV4cG9ydCB7IE9wcG9ydHVuaXR5QXBwcm92YWxGbG93IH0gZnJvbSAnLi9vcHBvcnR1bml0eS1hcHByb3ZhbC5mbG93JztcbmV4cG9ydCB7IFF1b3RlR2VuZXJhdGlvbkZsb3cgfSBmcm9tICcuL3F1b3RlLWdlbmVyYXRpb24uZmxvdyc7XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9mbG93cy9jYW1wYWlnbi1lbnJvbGxtZW50LmZsb3cudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvZmxvd3NcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvZmxvd3MvY2FtcGFpZ24tZW5yb2xsbWVudC5mbG93LnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5pbXBvcnQgdHlwZSB7IEF1dG9tYXRpb24gfSBmcm9tICdAb2JqZWN0c3RhY2svc3BlYyc7XG50eXBlIEZsb3cgPSBBdXRvbWF0aW9uLkZsb3c7XG5cbi8qKiBDYW1wYWlnbiBFbnJvbGxtZW50IFx1MjAxNCBzY2hlZHVsZWQgZmxvdyB0byBidWxrIGVucm9sbCBsZWFkcyAqL1xuZXhwb3J0IGNvbnN0IENhbXBhaWduRW5yb2xsbWVudEZsb3c6IEZsb3cgPSB7XG4gIG5hbWU6ICdjYW1wYWlnbl9lbnJvbGxtZW50JyxcbiAgbGFiZWw6ICdFbnJvbGwgTGVhZHMgaW4gQ2FtcGFpZ24nLFxuICBkZXNjcmlwdGlvbjogJ0J1bGsgZW5yb2xsIGxlYWRzIGludG8gbWFya2V0aW5nIGNhbXBhaWducycsXG4gIHR5cGU6ICdzY2hlZHVsZScsXG5cbiAgdmFyaWFibGVzOiBbXG4gICAgeyBuYW1lOiAnY2FtcGFpZ25JZCcsIHR5cGU6ICd0ZXh0JywgaXNJbnB1dDogdHJ1ZSwgaXNPdXRwdXQ6IGZhbHNlIH0sXG4gICAgeyBuYW1lOiAnbGVhZFN0YXR1cycsIHR5cGU6ICd0ZXh0JywgaXNJbnB1dDogdHJ1ZSwgaXNPdXRwdXQ6IGZhbHNlIH0sXG4gIF0sXG5cbiAgbm9kZXM6IFtcbiAgICB7IGlkOiAnc3RhcnQnLCB0eXBlOiAnc3RhcnQnLCBsYWJlbDogJ1N0YXJ0IChNb25kYXkgOSBBTSknLCBjb25maWc6IHsgc2NoZWR1bGU6ICcwIDkgKiAqIDEnIH0gfSxcbiAgICB7XG4gICAgICBpZDogJ2dldF9jYW1wYWlnbicsIHR5cGU6ICdnZXRfcmVjb3JkJywgbGFiZWw6ICdHZXQgQ2FtcGFpZ24nLFxuICAgICAgY29uZmlnOiB7IG9iamVjdE5hbWU6ICdjYW1wYWlnbicsIGZpbHRlcjogeyBpZDogJ3tjYW1wYWlnbklkfScgfSwgb3V0cHV0VmFyaWFibGU6ICdjYW1wYWlnblJlY29yZCcgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAncXVlcnlfbGVhZHMnLCB0eXBlOiAnZ2V0X3JlY29yZCcsIGxhYmVsOiAnRmluZCBFbGlnaWJsZSBMZWFkcycsXG4gICAgICBjb25maWc6IHsgb2JqZWN0TmFtZTogJ2xlYWQnLCBmaWx0ZXI6IHsgc3RhdHVzOiAne2xlYWRTdGF0dXN9JywgaXNfY29udmVydGVkOiBmYWxzZSwgZW1haWw6IHsgJG5lOiBudWxsIH0gfSwgbGltaXQ6IDEwMDAsIG91dHB1dFZhcmlhYmxlOiAnbGVhZExpc3QnIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2xvb3BfbGVhZHMnLCB0eXBlOiAnbG9vcCcsIGxhYmVsOiAnUHJvY2VzcyBFYWNoIExlYWQnLFxuICAgICAgY29uZmlnOiB7IGNvbGxlY3Rpb246ICd7bGVhZExpc3R9JywgaXRlcmF0b3JWYXJpYWJsZTogJ2N1cnJlbnRMZWFkJyB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdjcmVhdGVfY2FtcGFpZ25fbWVtYmVyJywgdHlwZTogJ2NyZWF0ZV9yZWNvcmQnLCBsYWJlbDogJ0FkZCB0byBDYW1wYWlnbicsXG4gICAgICBjb25maWc6IHtcbiAgICAgICAgb2JqZWN0TmFtZTogJ2NhbXBhaWduX21lbWJlcicsXG4gICAgICAgIGZpZWxkczogeyBjYW1wYWlnbjogJ3tjYW1wYWlnbklkfScsIGxlYWQ6ICd7Y3VycmVudExlYWQuaWR9Jywgc3RhdHVzOiAnc2VudCcsIGFkZGVkX2RhdGU6ICd7Tk9XKCl9JyB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAndXBkYXRlX2NhbXBhaWduX3N0YXRzJywgdHlwZTogJ3VwZGF0ZV9yZWNvcmQnLCBsYWJlbDogJ1VwZGF0ZSBDYW1wYWlnbiBTdGF0cycsXG4gICAgICBjb25maWc6IHsgb2JqZWN0TmFtZTogJ2NhbXBhaWduJywgZmlsdGVyOiB7IGlkOiAne2NhbXBhaWduSWR9JyB9LCBmaWVsZHM6IHsgbnVtX3NlbnQ6ICd7bGVhZExpc3QubGVuZ3RofScgfSB9LFxuICAgIH0sXG4gICAgeyBpZDogJ2VuZCcsIHR5cGU6ICdlbmQnLCBsYWJlbDogJ0VuZCcgfSxcbiAgXSxcblxuICBlZGdlczogW1xuICAgIHsgaWQ6ICdlMScsIHNvdXJjZTogJ3N0YXJ0JywgdGFyZ2V0OiAnZ2V0X2NhbXBhaWduJywgdHlwZTogJ2RlZmF1bHQnIH0sXG4gICAgeyBpZDogJ2UyJywgc291cmNlOiAnZ2V0X2NhbXBhaWduJywgdGFyZ2V0OiAncXVlcnlfbGVhZHMnLCB0eXBlOiAnZGVmYXVsdCcgfSxcbiAgICB7IGlkOiAnZTMnLCBzb3VyY2U6ICdxdWVyeV9sZWFkcycsIHRhcmdldDogJ2xvb3BfbGVhZHMnLCB0eXBlOiAnZGVmYXVsdCcgfSxcbiAgICB7IGlkOiAnZTQnLCBzb3VyY2U6ICdsb29wX2xlYWRzJywgdGFyZ2V0OiAnY3JlYXRlX2NhbXBhaWduX21lbWJlcicsIHR5cGU6ICdkZWZhdWx0JyB9LFxuICAgIHsgaWQ6ICdlNScsIHNvdXJjZTogJ2NyZWF0ZV9jYW1wYWlnbl9tZW1iZXInLCB0YXJnZXQ6ICd1cGRhdGVfY2FtcGFpZ25fc3RhdHMnLCB0eXBlOiAnZGVmYXVsdCcgfSxcbiAgICB7IGlkOiAnZTYnLCBzb3VyY2U6ICd1cGRhdGVfY2FtcGFpZ25fc3RhdHMnLCB0YXJnZXQ6ICdlbmQnLCB0eXBlOiAnZGVmYXVsdCcgfSxcbiAgXSxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9mbG93cy9jYXNlLWVzY2FsYXRpb24uZmxvdy50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9mbG93c1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9mbG93cy9jYXNlLWVzY2FsYXRpb24uZmxvdy50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuaW1wb3J0IHR5cGUgeyBBdXRvbWF0aW9uIH0gZnJvbSAnQG9iamVjdHN0YWNrL3NwZWMnO1xudHlwZSBGbG93ID0gQXV0b21hdGlvbi5GbG93O1xuXG4vKiogQ2FzZSBFc2NhbGF0aW9uIFx1MjAxNCBhdXRvLWVzY2FsYXRlIGhpZ2gtcHJpb3JpdHkgY2FzZXMgKi9cbmV4cG9ydCBjb25zdCBDYXNlRXNjYWxhdGlvbkZsb3c6IEZsb3cgPSB7XG4gIG5hbWU6ICdjYXNlX2VzY2FsYXRpb24nLFxuICBsYWJlbDogJ0Nhc2UgRXNjYWxhdGlvbiBQcm9jZXNzJyxcbiAgZGVzY3JpcHRpb246ICdBdXRvbWF0aWNhbGx5IGVzY2FsYXRlIGhpZ2gtcHJpb3JpdHkgY2FzZXMnLFxuICB0eXBlOiAncmVjb3JkX2NoYW5nZScsXG5cbiAgdmFyaWFibGVzOiBbXG4gICAgeyBuYW1lOiAnY2FzZUlkJywgdHlwZTogJ3RleHQnLCBpc0lucHV0OiB0cnVlLCBpc091dHB1dDogZmFsc2UgfSxcbiAgXSxcblxuICBub2RlczogW1xuICAgIHtcbiAgICAgIGlkOiAnc3RhcnQnLCB0eXBlOiAnc3RhcnQnLCBsYWJlbDogJ1N0YXJ0JyxcbiAgICAgIGNvbmZpZzogeyBvYmplY3ROYW1lOiAnY2FzZScsIGNyaXRlcmlhOiAncHJpb3JpdHkgPSBcImNyaXRpY2FsXCIgT1IgKHByaW9yaXR5ID0gXCJoaWdoXCIgQU5EIGFjY291bnQudHlwZSA9IFwiY3VzdG9tZXJcIiknIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2dldF9jYXNlJywgdHlwZTogJ2dldF9yZWNvcmQnLCBsYWJlbDogJ0dldCBDYXNlIFJlY29yZCcsXG4gICAgICBjb25maWc6IHsgb2JqZWN0TmFtZTogJ2Nhc2UnLCBmaWx0ZXI6IHsgaWQ6ICd7Y2FzZUlkfScgfSwgb3V0cHV0VmFyaWFibGU6ICdjYXNlUmVjb3JkJyB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdhc3NpZ25fc2VuaW9yX2FnZW50JywgdHlwZTogJ3VwZGF0ZV9yZWNvcmQnLCBsYWJlbDogJ0Fzc2lnbiB0byBTZW5pb3IgQWdlbnQnLFxuICAgICAgY29uZmlnOiB7XG4gICAgICAgIG9iamVjdE5hbWU6ICdjYXNlJywgZmlsdGVyOiB7IGlkOiAne2Nhc2VJZH0nIH0sXG4gICAgICAgIGZpZWxkczogeyBvd25lcjogJ3tjYXNlUmVjb3JkLm93bmVyLm1hbmFnZXJ9JywgaXNfZXNjYWxhdGVkOiB0cnVlLCBlc2NhbGF0ZWRfZGF0ZTogJ3tOT1coKX0nIH0sXG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdjcmVhdGVfdGFzaycsIHR5cGU6ICdjcmVhdGVfcmVjb3JkJywgbGFiZWw6ICdDcmVhdGUgRm9sbG93LXVwIFRhc2snLFxuICAgICAgY29uZmlnOiB7XG4gICAgICAgIG9iamVjdE5hbWU6ICd0YXNrJyxcbiAgICAgICAgZmllbGRzOiB7XG4gICAgICAgICAgc3ViamVjdDogJ0ZvbGxvdyB1cCBvbiBlc2NhbGF0ZWQgY2FzZToge2Nhc2VSZWNvcmQuY2FzZV9udW1iZXJ9JyxcbiAgICAgICAgICByZWxhdGVkX3RvOiAne2Nhc2VJZH0nLCBvd25lcjogJ3tjYXNlUmVjb3JkLm93bmVyfScsXG4gICAgICAgICAgcHJpb3JpdHk6ICdoaWdoJywgc3RhdHVzOiAnbm90X3N0YXJ0ZWQnLCBkdWVfZGF0ZTogJ3tUT0RBWSgpICsgMX0nLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnbm90aWZ5X3RlYW0nLCB0eXBlOiAnc2NyaXB0JywgbGFiZWw6ICdOb3RpZnkgU3VwcG9ydCBUZWFtJyxcbiAgICAgIGNvbmZpZzoge1xuICAgICAgICBhY3Rpb25UeXBlOiAnZW1haWwnLFxuICAgICAgICB0ZW1wbGF0ZTogJ2Nhc2VfZXNjYWxhdGVkJyxcbiAgICAgICAgcmVjaXBpZW50czogWyd7Y2FzZVJlY29yZC5vd25lcn0nLCAne2Nhc2VSZWNvcmQub3duZXIubWFuYWdlcn0nLCAnc3VwcG9ydC10ZWFtQGV4YW1wbGUuY29tJ10sXG4gICAgICAgIHZhcmlhYmxlczoge1xuICAgICAgICAgIGNhc2VOdW1iZXI6ICd7Y2FzZVJlY29yZC5jYXNlX251bWJlcn0nLFxuICAgICAgICAgIHByaW9yaXR5OiAne2Nhc2VSZWNvcmQucHJpb3JpdHl9JyxcbiAgICAgICAgICBhY2NvdW50TmFtZTogJ3tjYXNlUmVjb3JkLmFjY291bnQubmFtZX0nLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIHsgaWQ6ICdlbmQnLCB0eXBlOiAnZW5kJywgbGFiZWw6ICdFbmQnIH0sXG4gIF0sXG5cbiAgZWRnZXM6IFtcbiAgICB7IGlkOiAnZTEnLCBzb3VyY2U6ICdzdGFydCcsIHRhcmdldDogJ2dldF9jYXNlJywgdHlwZTogJ2RlZmF1bHQnIH0sXG4gICAgeyBpZDogJ2UyJywgc291cmNlOiAnZ2V0X2Nhc2UnLCB0YXJnZXQ6ICdhc3NpZ25fc2VuaW9yX2FnZW50JywgdHlwZTogJ2RlZmF1bHQnIH0sXG4gICAgeyBpZDogJ2UzJywgc291cmNlOiAnYXNzaWduX3Nlbmlvcl9hZ2VudCcsIHRhcmdldDogJ2NyZWF0ZV90YXNrJywgdHlwZTogJ2RlZmF1bHQnIH0sXG4gICAgeyBpZDogJ2U0Jywgc291cmNlOiAnY3JlYXRlX3Rhc2snLCB0YXJnZXQ6ICdub3RpZnlfdGVhbScsIHR5cGU6ICdkZWZhdWx0JyB9LFxuICAgIHsgaWQ6ICdlNScsIHNvdXJjZTogJ25vdGlmeV90ZWFtJywgdGFyZ2V0OiAnZW5kJywgdHlwZTogJ2RlZmF1bHQnIH0sXG4gIF0sXG59O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvZmxvd3MvbGVhZC1jb252ZXJzaW9uLmZsb3cudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvZmxvd3NcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvZmxvd3MvbGVhZC1jb252ZXJzaW9uLmZsb3cudHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbmltcG9ydCB0eXBlIHsgQXV0b21hdGlvbiB9IGZyb20gJ0BvYmplY3RzdGFjay9zcGVjJztcbnR5cGUgRmxvdyA9IEF1dG9tYXRpb24uRmxvdztcblxuLyoqIExlYWQgQ29udmVyc2lvbiBcdTIwMTQgbXVsdGktc3RlcCBzY3JlZW4gZmxvdyB0byBjb252ZXJ0IHF1YWxpZmllZCBsZWFkcyAqL1xuZXhwb3J0IGNvbnN0IExlYWRDb252ZXJzaW9uRmxvdzogRmxvdyA9IHtcbiAgbmFtZTogJ2xlYWRfY29udmVyc2lvbicsXG4gIGxhYmVsOiAnTGVhZCBDb252ZXJzaW9uIFByb2Nlc3MnLFxuICBkZXNjcmlwdGlvbjogJ0F1dG9tYXRlZCBmbG93IHRvIGNvbnZlcnQgcXVhbGlmaWVkIGxlYWRzIHRvIGFjY291bnRzLCBjb250YWN0cywgYW5kIG9wcG9ydHVuaXRpZXMnLFxuICB0eXBlOiAnc2NyZWVuJyxcblxuICB2YXJpYWJsZXM6IFtcbiAgICB7IG5hbWU6ICdsZWFkSWQnLCB0eXBlOiAndGV4dCcsIGlzSW5wdXQ6IHRydWUsIGlzT3V0cHV0OiBmYWxzZSB9LFxuICAgIHsgbmFtZTogJ2NyZWF0ZU9wcG9ydHVuaXR5JywgdHlwZTogJ2Jvb2xlYW4nLCBpc0lucHV0OiB0cnVlLCBpc091dHB1dDogZmFsc2UgfSxcbiAgICB7IG5hbWU6ICdvcHBvcnR1bml0eU5hbWUnLCB0eXBlOiAndGV4dCcsIGlzSW5wdXQ6IHRydWUsIGlzT3V0cHV0OiBmYWxzZSB9LFxuICAgIHsgbmFtZTogJ29wcG9ydHVuaXR5QW1vdW50JywgdHlwZTogJ3RleHQnLCBpc0lucHV0OiB0cnVlLCBpc091dHB1dDogZmFsc2UgfSxcbiAgXSxcblxuICBub2RlczogW1xuICAgIHsgaWQ6ICdzdGFydCcsIHR5cGU6ICdzdGFydCcsIGxhYmVsOiAnU3RhcnQnLCBjb25maWc6IHsgb2JqZWN0TmFtZTogJ2xlYWQnIH0gfSxcbiAgICB7XG4gICAgICBpZDogJ3NjcmVlbl8xJywgdHlwZTogJ3NjcmVlbicsIGxhYmVsOiAnQ29udmVyc2lvbiBEZXRhaWxzJyxcbiAgICAgIGNvbmZpZzoge1xuICAgICAgICBmaWVsZHM6IFtcbiAgICAgICAgICB7IG5hbWU6ICdjcmVhdGVPcHBvcnR1bml0eScsIGxhYmVsOiAnQ3JlYXRlIE9wcG9ydHVuaXR5PycsIHR5cGU6ICdib29sZWFuJywgcmVxdWlyZWQ6IHRydWUgfSxcbiAgICAgICAgICB7IG5hbWU6ICdvcHBvcnR1bml0eU5hbWUnLCBsYWJlbDogJ09wcG9ydHVuaXR5IE5hbWUnLCB0eXBlOiAndGV4dCcsIHJlcXVpcmVkOiB0cnVlLCB2aXNpYmxlV2hlbjogJ3tjcmVhdGVPcHBvcnR1bml0eX0gPT0gdHJ1ZScgfSxcbiAgICAgICAgICB7IG5hbWU6ICdvcHBvcnR1bml0eUFtb3VudCcsIGxhYmVsOiAnT3Bwb3J0dW5pdHkgQW1vdW50JywgdHlwZTogJ2N1cnJlbmN5JywgdmlzaWJsZVdoZW46ICd7Y3JlYXRlT3Bwb3J0dW5pdHl9ID09IHRydWUnIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdnZXRfbGVhZCcsIHR5cGU6ICdnZXRfcmVjb3JkJywgbGFiZWw6ICdHZXQgTGVhZCBSZWNvcmQnLFxuICAgICAgY29uZmlnOiB7IG9iamVjdE5hbWU6ICdsZWFkJywgZmlsdGVyOiB7IGlkOiAne2xlYWRJZH0nIH0sIG91dHB1dFZhcmlhYmxlOiAnbGVhZFJlY29yZCcgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnY3JlYXRlX2FjY291bnQnLCB0eXBlOiAnY3JlYXRlX3JlY29yZCcsIGxhYmVsOiAnQ3JlYXRlIEFjY291bnQnLFxuICAgICAgY29uZmlnOiB7XG4gICAgICAgIG9iamVjdE5hbWU6ICdhY2NvdW50JyxcbiAgICAgICAgZmllbGRzOiB7XG4gICAgICAgICAgbmFtZTogJ3tsZWFkUmVjb3JkLmNvbXBhbnl9JywgcGhvbmU6ICd7bGVhZFJlY29yZC5waG9uZX0nLFxuICAgICAgICAgIHdlYnNpdGU6ICd7bGVhZFJlY29yZC53ZWJzaXRlfScsIGluZHVzdHJ5OiAne2xlYWRSZWNvcmQuaW5kdXN0cnl9JyxcbiAgICAgICAgICBhbm51YWxfcmV2ZW51ZTogJ3tsZWFkUmVjb3JkLmFubnVhbF9yZXZlbnVlfScsXG4gICAgICAgICAgbnVtYmVyX29mX2VtcGxveWVlczogJ3tsZWFkUmVjb3JkLm51bWJlcl9vZl9lbXBsb3llZXN9JyxcbiAgICAgICAgICBiaWxsaW5nX2FkZHJlc3M6ICd7bGVhZFJlY29yZC5hZGRyZXNzfScsXG4gICAgICAgICAgb3duZXI6ICd7JFVzZXIuSWR9JywgaXNfYWN0aXZlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBvdXRwdXRWYXJpYWJsZTogJ2FjY291bnRJZCcsXG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdjcmVhdGVfY29udGFjdCcsIHR5cGU6ICdjcmVhdGVfcmVjb3JkJywgbGFiZWw6ICdDcmVhdGUgQ29udGFjdCcsXG4gICAgICBjb25maWc6IHtcbiAgICAgICAgb2JqZWN0TmFtZTogJ2NvbnRhY3QnLFxuICAgICAgICBmaWVsZHM6IHtcbiAgICAgICAgICBmaXJzdF9uYW1lOiAne2xlYWRSZWNvcmQuZmlyc3RfbmFtZX0nLCBsYXN0X25hbWU6ICd7bGVhZFJlY29yZC5sYXN0X25hbWV9JyxcbiAgICAgICAgICBlbWFpbDogJ3tsZWFkUmVjb3JkLmVtYWlsfScsIHBob25lOiAne2xlYWRSZWNvcmQucGhvbmV9JyxcbiAgICAgICAgICB0aXRsZTogJ3tsZWFkUmVjb3JkLnRpdGxlfScsIGFjY291bnQ6ICd7YWNjb3VudElkfScsXG4gICAgICAgICAgaXNfcHJpbWFyeTogdHJ1ZSwgb3duZXI6ICd7JFVzZXIuSWR9JyxcbiAgICAgICAgfSxcbiAgICAgICAgb3V0cHV0VmFyaWFibGU6ICdjb250YWN0SWQnLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnZGVjaXNpb25fb3Bwb3J0dW5pdHknLCB0eXBlOiAnZGVjaXNpb24nLCBsYWJlbDogJ0NyZWF0ZSBPcHBvcnR1bml0eT8nLFxuICAgICAgY29uZmlnOiB7IGNvbmRpdGlvbjogJ3tjcmVhdGVPcHBvcnR1bml0eX0gPT0gdHJ1ZScgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnY3JlYXRlX29wcG9ydHVuaXR5JywgdHlwZTogJ2NyZWF0ZV9yZWNvcmQnLCBsYWJlbDogJ0NyZWF0ZSBPcHBvcnR1bml0eScsXG4gICAgICBjb25maWc6IHtcbiAgICAgICAgb2JqZWN0TmFtZTogJ29wcG9ydHVuaXR5JyxcbiAgICAgICAgZmllbGRzOiB7XG4gICAgICAgICAgbmFtZTogJ3tvcHBvcnR1bml0eU5hbWV9JywgYWNjb3VudDogJ3thY2NvdW50SWR9JywgY29udGFjdDogJ3tjb250YWN0SWR9JyxcbiAgICAgICAgICBhbW91bnQ6ICd7b3Bwb3J0dW5pdHlBbW91bnR9Jywgc3RhZ2U6ICdwcm9zcGVjdGluZycsIHByb2JhYmlsaXR5OiAxMCxcbiAgICAgICAgICBsZWFkX3NvdXJjZTogJ3tsZWFkUmVjb3JkLmxlYWRfc291cmNlfScsIGNsb3NlX2RhdGU6ICd7VE9EQVkoKSArIDkwfScsIG93bmVyOiAneyRVc2VyLklkfScsXG4gICAgICAgIH0sXG4gICAgICAgIG91dHB1dFZhcmlhYmxlOiAnb3Bwb3J0dW5pdHlJZCcsXG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdtYXJrX2NvbnZlcnRlZCcsIHR5cGU6ICd1cGRhdGVfcmVjb3JkJywgbGFiZWw6ICdNYXJrIExlYWQgYXMgQ29udmVydGVkJyxcbiAgICAgIGNvbmZpZzoge1xuICAgICAgICBvYmplY3ROYW1lOiAnbGVhZCcsIGZpbHRlcjogeyBpZDogJ3tsZWFkSWR9JyB9LFxuICAgICAgICBmaWVsZHM6IHtcbiAgICAgICAgICBpc19jb252ZXJ0ZWQ6IHRydWUsIGNvbnZlcnRlZF9kYXRlOiAne05PVygpfScsXG4gICAgICAgICAgY29udmVydGVkX2FjY291bnQ6ICd7YWNjb3VudElkfScsIGNvbnZlcnRlZF9jb250YWN0OiAne2NvbnRhY3RJZH0nLFxuICAgICAgICAgIGNvbnZlcnRlZF9vcHBvcnR1bml0eTogJ3tvcHBvcnR1bml0eUlkfScsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdzZW5kX25vdGlmaWNhdGlvbicsIHR5cGU6ICdzY3JpcHQnLCBsYWJlbDogJ1NlbmQgQ29uZmlybWF0aW9uIEVtYWlsJyxcbiAgICAgIGNvbmZpZzoge1xuICAgICAgICBhY3Rpb25UeXBlOiAnZW1haWwnLCB0ZW1wbGF0ZTogJ2xlYWRfY29udmVydGVkX25vdGlmaWNhdGlvbicsXG4gICAgICAgIHJlY2lwaWVudHM6IFsneyRVc2VyLkVtYWlsfSddLFxuICAgICAgICB2YXJpYWJsZXM6IHsgbGVhZE5hbWU6ICd7bGVhZFJlY29yZC5mdWxsX25hbWV9JywgYWNjb3VudE5hbWU6ICd7YWNjb3VudElkLm5hbWV9JywgY29udGFjdE5hbWU6ICd7Y29udGFjdElkLmZ1bGxfbmFtZX0nIH0sXG4gICAgICB9LFxuICAgIH0sXG4gICAgeyBpZDogJ2VuZCcsIHR5cGU6ICdlbmQnLCBsYWJlbDogJ0VuZCcgfSxcbiAgXSxcblxuICBlZGdlczogW1xuICAgIHsgaWQ6ICdlMScsIHNvdXJjZTogJ3N0YXJ0JywgdGFyZ2V0OiAnc2NyZWVuXzEnLCB0eXBlOiAnZGVmYXVsdCcgfSxcbiAgICB7IGlkOiAnZTInLCBzb3VyY2U6ICdzY3JlZW5fMScsIHRhcmdldDogJ2dldF9sZWFkJywgdHlwZTogJ2RlZmF1bHQnIH0sXG4gICAgeyBpZDogJ2UzJywgc291cmNlOiAnZ2V0X2xlYWQnLCB0YXJnZXQ6ICdjcmVhdGVfYWNjb3VudCcsIHR5cGU6ICdkZWZhdWx0JyB9LFxuICAgIHsgaWQ6ICdlNCcsIHNvdXJjZTogJ2NyZWF0ZV9hY2NvdW50JywgdGFyZ2V0OiAnY3JlYXRlX2NvbnRhY3QnLCB0eXBlOiAnZGVmYXVsdCcgfSxcbiAgICB7IGlkOiAnZTUnLCBzb3VyY2U6ICdjcmVhdGVfY29udGFjdCcsIHRhcmdldDogJ2RlY2lzaW9uX29wcG9ydHVuaXR5JywgdHlwZTogJ2RlZmF1bHQnIH0sXG4gICAgeyBpZDogJ2U2Jywgc291cmNlOiAnZGVjaXNpb25fb3Bwb3J0dW5pdHknLCB0YXJnZXQ6ICdjcmVhdGVfb3Bwb3J0dW5pdHknLCB0eXBlOiAnZGVmYXVsdCcsIGNvbmRpdGlvbjogJ3tjcmVhdGVPcHBvcnR1bml0eX0gPT0gdHJ1ZScsIGxhYmVsOiAnWWVzJyB9LFxuICAgIHsgaWQ6ICdlNycsIHNvdXJjZTogJ2RlY2lzaW9uX29wcG9ydHVuaXR5JywgdGFyZ2V0OiAnbWFya19jb252ZXJ0ZWQnLCB0eXBlOiAnZGVmYXVsdCcsIGNvbmRpdGlvbjogJ3tjcmVhdGVPcHBvcnR1bml0eX0gIT0gdHJ1ZScsIGxhYmVsOiAnTm8nIH0sXG4gICAgeyBpZDogJ2U4Jywgc291cmNlOiAnY3JlYXRlX29wcG9ydHVuaXR5JywgdGFyZ2V0OiAnbWFya19jb252ZXJ0ZWQnLCB0eXBlOiAnZGVmYXVsdCcgfSxcbiAgICB7IGlkOiAnZTknLCBzb3VyY2U6ICdtYXJrX2NvbnZlcnRlZCcsIHRhcmdldDogJ3NlbmRfbm90aWZpY2F0aW9uJywgdHlwZTogJ2RlZmF1bHQnIH0sXG4gICAgeyBpZDogJ2UxMCcsIHNvdXJjZTogJ3NlbmRfbm90aWZpY2F0aW9uJywgdGFyZ2V0OiAnZW5kJywgdHlwZTogJ2RlZmF1bHQnIH0sXG4gIF0sXG59O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvZmxvd3Mvb3Bwb3J0dW5pdHktYXBwcm92YWwuZmxvdy50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9mbG93c1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9mbG93cy9vcHBvcnR1bml0eS1hcHByb3ZhbC5mbG93LnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5pbXBvcnQgdHlwZSB7IEF1dG9tYXRpb24gfSBmcm9tICdAb2JqZWN0c3RhY2svc3BlYyc7XG50eXBlIEZsb3cgPSBBdXRvbWF0aW9uLkZsb3c7XG5cbi8qKiBPcHBvcnR1bml0eSBBcHByb3ZhbCBcdTIwMTQgbXVsdGktbGV2ZWwgYXBwcm92YWwgZm9yIGRlYWxzIG92ZXIgJDEwMEsgKi9cbmV4cG9ydCBjb25zdCBPcHBvcnR1bml0eUFwcHJvdmFsRmxvdzogRmxvdyA9IHtcbiAgbmFtZTogJ29wcG9ydHVuaXR5X2FwcHJvdmFsJyxcbiAgbGFiZWw6ICdMYXJnZSBEZWFsIEFwcHJvdmFsJyxcbiAgZGVzY3JpcHRpb246ICdBcHByb3ZhbCBwcm9jZXNzIGZvciBvcHBvcnR1bml0aWVzIG92ZXIgJDEwMEsnLFxuICB0eXBlOiAncmVjb3JkX2NoYW5nZScsXG5cbiAgdmFyaWFibGVzOiBbXG4gICAgeyBuYW1lOiAnb3Bwb3J0dW5pdHlJZCcsIHR5cGU6ICd0ZXh0JywgaXNJbnB1dDogdHJ1ZSwgaXNPdXRwdXQ6IGZhbHNlIH0sXG4gIF0sXG5cbiAgbm9kZXM6IFtcbiAgICB7XG4gICAgICBpZDogJ3N0YXJ0JywgdHlwZTogJ3N0YXJ0JywgbGFiZWw6ICdTdGFydCcsXG4gICAgICBjb25maWc6IHsgb2JqZWN0TmFtZTogJ29wcG9ydHVuaXR5JywgY3JpdGVyaWE6ICdhbW91bnQgPiAxMDAwMDAgQU5EIHN0YWdlID0gXCJwcm9wb3NhbFwiJyB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdnZXRfb3Bwb3J0dW5pdHknLCB0eXBlOiAnZ2V0X3JlY29yZCcsIGxhYmVsOiAnR2V0IE9wcG9ydHVuaXR5JyxcbiAgICAgIGNvbmZpZzogeyBvYmplY3ROYW1lOiAnb3Bwb3J0dW5pdHknLCBmaWx0ZXI6IHsgaWQ6ICd7b3Bwb3J0dW5pdHlJZH0nIH0sIG91dHB1dFZhcmlhYmxlOiAnb3BwUmVjb3JkJyB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdhcHByb3ZhbF9zdGVwX21hbmFnZXInLCB0eXBlOiAnY29ubmVjdG9yX2FjdGlvbicsIGxhYmVsOiAnU2FsZXMgTWFuYWdlciBBcHByb3ZhbCcsXG4gICAgICBjb25maWc6IHtcbiAgICAgICAgYWN0aW9uVHlwZTogJ2FwcHJvdmFsJyxcbiAgICAgICAgYXBwcm92ZXI6ICd7b3BwUmVjb3JkLm93bmVyLm1hbmFnZXJ9JyxcbiAgICAgICAgZW1haWxUZW1wbGF0ZTogJ29wcG9ydHVuaXR5X2FwcHJvdmFsX3JlcXVlc3QnLFxuICAgICAgICBjb21tZW50czogJ3JlcXVpcmVkJyxcbiAgICAgIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2RlY2lzaW9uX21hbmFnZXInLCB0eXBlOiAnZGVjaXNpb24nLCBsYWJlbDogJ01hbmFnZXIgQXBwcm92ZWQ/JyxcbiAgICAgIGNvbmZpZzogeyBjb25kaXRpb246ICd7YXBwcm92YWxfc3RlcF9tYW5hZ2VyLnJlc3VsdH0gPT0gXCJhcHByb3ZlZFwiJyB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdhcHByb3ZhbF9zdGVwX2RpcmVjdG9yJywgdHlwZTogJ2Nvbm5lY3Rvcl9hY3Rpb24nLCBsYWJlbDogJ1NhbGVzIERpcmVjdG9yIEFwcHJvdmFsJyxcbiAgICAgIGNvbmZpZzoge1xuICAgICAgICBhY3Rpb25UeXBlOiAnYXBwcm92YWwnLFxuICAgICAgICBhcHByb3ZlcjogJ3tvcHBSZWNvcmQub3duZXIubWFuYWdlci5tYW5hZ2VyfScsXG4gICAgICAgIGVtYWlsVGVtcGxhdGU6ICdvcHBvcnR1bml0eV9hcHByb3ZhbF9yZXF1ZXN0JyxcbiAgICAgIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2RlY2lzaW9uX2RpcmVjdG9yJywgdHlwZTogJ2RlY2lzaW9uJywgbGFiZWw6ICdEaXJlY3RvciBBcHByb3ZlZD8nLFxuICAgICAgY29uZmlnOiB7IGNvbmRpdGlvbjogJ3thcHByb3ZhbF9zdGVwX2RpcmVjdG9yLnJlc3VsdH0gPT0gXCJhcHByb3ZlZFwiJyB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdtYXJrX2FwcHJvdmVkJywgdHlwZTogJ3VwZGF0ZV9yZWNvcmQnLCBsYWJlbDogJ01hcmsgYXMgQXBwcm92ZWQnLFxuICAgICAgY29uZmlnOiB7XG4gICAgICAgIG9iamVjdE5hbWU6ICdvcHBvcnR1bml0eScsIGZpbHRlcjogeyBpZDogJ3tvcHBvcnR1bml0eUlkfScgfSxcbiAgICAgICAgZmllbGRzOiB7IGFwcHJvdmFsX3N0YXR1czogJ2FwcHJvdmVkJywgYXBwcm92ZWRfZGF0ZTogJ3tOT1coKX0nIH0sXG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdub3RpZnlfYXBwcm92YWwnLCB0eXBlOiAnc2NyaXB0JywgbGFiZWw6ICdTZW5kIEFwcHJvdmFsIE5vdGlmaWNhdGlvbicsXG4gICAgICBjb25maWc6IHsgYWN0aW9uVHlwZTogJ2VtYWlsJywgdGVtcGxhdGU6ICdvcHBvcnR1bml0eV9hcHByb3ZlZCcsIHJlY2lwaWVudHM6IFsne29wcFJlY29yZC5vd25lcn0nXSB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdub3RpZnlfcmVqZWN0aW9uJywgdHlwZTogJ3NjcmlwdCcsIGxhYmVsOiAnU2VuZCBSZWplY3Rpb24gTm90aWZpY2F0aW9uJyxcbiAgICAgIGNvbmZpZzogeyBhY3Rpb25UeXBlOiAnZW1haWwnLCB0ZW1wbGF0ZTogJ29wcG9ydHVuaXR5X3JlamVjdGVkJywgcmVjaXBpZW50czogWyd7b3BwUmVjb3JkLm93bmVyfSddIH0sXG4gICAgfSxcbiAgICB7IGlkOiAnZW5kJywgdHlwZTogJ2VuZCcsIGxhYmVsOiAnRW5kJyB9LFxuICBdLFxuXG4gIGVkZ2VzOiBbXG4gICAgeyBpZDogJ2UxJywgc291cmNlOiAnc3RhcnQnLCB0YXJnZXQ6ICdnZXRfb3Bwb3J0dW5pdHknLCB0eXBlOiAnZGVmYXVsdCcgfSxcbiAgICB7IGlkOiAnZTInLCBzb3VyY2U6ICdnZXRfb3Bwb3J0dW5pdHknLCB0YXJnZXQ6ICdhcHByb3ZhbF9zdGVwX21hbmFnZXInLCB0eXBlOiAnZGVmYXVsdCcgfSxcbiAgICB7IGlkOiAnZTMnLCBzb3VyY2U6ICdhcHByb3ZhbF9zdGVwX21hbmFnZXInLCB0YXJnZXQ6ICdkZWNpc2lvbl9tYW5hZ2VyJywgdHlwZTogJ2RlZmF1bHQnIH0sXG4gICAgeyBpZDogJ2U0Jywgc291cmNlOiAnZGVjaXNpb25fbWFuYWdlcicsIHRhcmdldDogJ2FwcHJvdmFsX3N0ZXBfZGlyZWN0b3InLCB0eXBlOiAnZGVmYXVsdCcsIGNvbmRpdGlvbjogJ3thcHByb3ZhbF9zdGVwX21hbmFnZXIucmVzdWx0fSA9PSBcImFwcHJvdmVkXCInLCBsYWJlbDogJ0FwcHJvdmVkJyB9LFxuICAgIHsgaWQ6ICdlNScsIHNvdXJjZTogJ2RlY2lzaW9uX21hbmFnZXInLCB0YXJnZXQ6ICdub3RpZnlfcmVqZWN0aW9uJywgdHlwZTogJ2RlZmF1bHQnLCBjb25kaXRpb246ICd7YXBwcm92YWxfc3RlcF9tYW5hZ2VyLnJlc3VsdH0gIT0gXCJhcHByb3ZlZFwiJywgbGFiZWw6ICdSZWplY3RlZCcgfSxcbiAgICB7IGlkOiAnZTYnLCBzb3VyY2U6ICdhcHByb3ZhbF9zdGVwX2RpcmVjdG9yJywgdGFyZ2V0OiAnZGVjaXNpb25fZGlyZWN0b3InLCB0eXBlOiAnZGVmYXVsdCcgfSxcbiAgICB7IGlkOiAnZTcnLCBzb3VyY2U6ICdkZWNpc2lvbl9kaXJlY3RvcicsIHRhcmdldDogJ21hcmtfYXBwcm92ZWQnLCB0eXBlOiAnZGVmYXVsdCcsIGNvbmRpdGlvbjogJ3thcHByb3ZhbF9zdGVwX2RpcmVjdG9yLnJlc3VsdH0gPT0gXCJhcHByb3ZlZFwiJywgbGFiZWw6ICdBcHByb3ZlZCcgfSxcbiAgICB7IGlkOiAnZTgnLCBzb3VyY2U6ICdkZWNpc2lvbl9kaXJlY3RvcicsIHRhcmdldDogJ25vdGlmeV9yZWplY3Rpb24nLCB0eXBlOiAnZGVmYXVsdCcsIGNvbmRpdGlvbjogJ3thcHByb3ZhbF9zdGVwX2RpcmVjdG9yLnJlc3VsdH0gIT0gXCJhcHByb3ZlZFwiJywgbGFiZWw6ICdSZWplY3RlZCcgfSxcbiAgICB7IGlkOiAnZTknLCBzb3VyY2U6ICdtYXJrX2FwcHJvdmVkJywgdGFyZ2V0OiAnbm90aWZ5X2FwcHJvdmFsJywgdHlwZTogJ2RlZmF1bHQnIH0sXG4gICAgeyBpZDogJ2UxMCcsIHNvdXJjZTogJ25vdGlmeV9hcHByb3ZhbCcsIHRhcmdldDogJ2VuZCcsIHR5cGU6ICdkZWZhdWx0JyB9LFxuICAgIHsgaWQ6ICdlMTEnLCBzb3VyY2U6ICdub3RpZnlfcmVqZWN0aW9uJywgdGFyZ2V0OiAnZW5kJywgdHlwZTogJ2RlZmF1bHQnIH0sXG4gIF0sXG59O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvZmxvd3MvcXVvdGUtZ2VuZXJhdGlvbi5mbG93LnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2Zsb3dzXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2Zsb3dzL3F1b3RlLWdlbmVyYXRpb24uZmxvdy50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuaW1wb3J0IHR5cGUgeyBBdXRvbWF0aW9uIH0gZnJvbSAnQG9iamVjdHN0YWNrL3NwZWMnO1xudHlwZSBGbG93ID0gQXV0b21hdGlvbi5GbG93O1xuXG4vKiogUXVvdGUgR2VuZXJhdGlvbiBcdTIwMTQgc2NyZWVuIGZsb3cgdG8gY3JlYXRlIGEgcXVvdGUgZnJvbSBhbiBvcHBvcnR1bml0eSAqL1xuZXhwb3J0IGNvbnN0IFF1b3RlR2VuZXJhdGlvbkZsb3c6IEZsb3cgPSB7XG4gIG5hbWU6ICdxdW90ZV9nZW5lcmF0aW9uJyxcbiAgbGFiZWw6ICdHZW5lcmF0ZSBRdW90ZSBmcm9tIE9wcG9ydHVuaXR5JyxcbiAgZGVzY3JpcHRpb246ICdDcmVhdGUgYSBxdW90ZSBiYXNlZCBvbiBvcHBvcnR1bml0eSBkZXRhaWxzJyxcbiAgdHlwZTogJ3NjcmVlbicsXG5cbiAgdmFyaWFibGVzOiBbXG4gICAgeyBuYW1lOiAnb3Bwb3J0dW5pdHlJZCcsIHR5cGU6ICd0ZXh0JywgaXNJbnB1dDogdHJ1ZSwgaXNPdXRwdXQ6IGZhbHNlIH0sXG4gICAgeyBuYW1lOiAncXVvdGVOYW1lJywgdHlwZTogJ3RleHQnLCBpc0lucHV0OiB0cnVlLCBpc091dHB1dDogZmFsc2UgfSxcbiAgICB7IG5hbWU6ICdleHBpcmF0aW9uRGF5cycsIHR5cGU6ICdudW1iZXInLCBpc0lucHV0OiB0cnVlLCBpc091dHB1dDogZmFsc2UgfSxcbiAgICB7IG5hbWU6ICdkaXNjb3VudCcsIHR5cGU6ICdudW1iZXInLCBpc0lucHV0OiB0cnVlLCBpc091dHB1dDogZmFsc2UgfSxcbiAgXSxcblxuICBub2RlczogW1xuICAgIHsgaWQ6ICdzdGFydCcsIHR5cGU6ICdzdGFydCcsIGxhYmVsOiAnU3RhcnQnLCBjb25maWc6IHsgb2JqZWN0TmFtZTogJ29wcG9ydHVuaXR5JyB9IH0sXG4gICAge1xuICAgICAgaWQ6ICdzY3JlZW5fMScsIHR5cGU6ICdzY3JlZW4nLCBsYWJlbDogJ1F1b3RlIERldGFpbHMnLFxuICAgICAgY29uZmlnOiB7XG4gICAgICAgIGZpZWxkczogW1xuICAgICAgICAgIHsgbmFtZTogJ3F1b3RlTmFtZScsIGxhYmVsOiAnUXVvdGUgTmFtZScsIHR5cGU6ICd0ZXh0JywgcmVxdWlyZWQ6IHRydWUgfSxcbiAgICAgICAgICB7IG5hbWU6ICdleHBpcmF0aW9uRGF5cycsIGxhYmVsOiAnVmFsaWQgRm9yIChEYXlzKScsIHR5cGU6ICdudW1iZXInLCByZXF1aXJlZDogdHJ1ZSwgZGVmYXVsdFZhbHVlOiAzMCB9LFxuICAgICAgICAgIHsgbmFtZTogJ2Rpc2NvdW50JywgbGFiZWw6ICdEaXNjb3VudCAlJywgdHlwZTogJ3BlcmNlbnQnLCBkZWZhdWx0VmFsdWU6IDAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2dldF9vcHBvcnR1bml0eScsIHR5cGU6ICdnZXRfcmVjb3JkJywgbGFiZWw6ICdHZXQgT3Bwb3J0dW5pdHknLFxuICAgICAgY29uZmlnOiB7IG9iamVjdE5hbWU6ICdvcHBvcnR1bml0eScsIGZpbHRlcjogeyBpZDogJ3tvcHBvcnR1bml0eUlkfScgfSwgb3V0cHV0VmFyaWFibGU6ICdvcHBSZWNvcmQnIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2NyZWF0ZV9xdW90ZScsIHR5cGU6ICdjcmVhdGVfcmVjb3JkJywgbGFiZWw6ICdDcmVhdGUgUXVvdGUnLFxuICAgICAgY29uZmlnOiB7XG4gICAgICAgIG9iamVjdE5hbWU6ICdxdW90ZScsXG4gICAgICAgIGZpZWxkczoge1xuICAgICAgICAgIG5hbWU6ICd7cXVvdGVOYW1lfScsIG9wcG9ydHVuaXR5OiAne29wcG9ydHVuaXR5SWR9JyxcbiAgICAgICAgICBhY2NvdW50OiAne29wcFJlY29yZC5hY2NvdW50fScsIGNvbnRhY3Q6ICd7b3BwUmVjb3JkLmNvbnRhY3R9JyxcbiAgICAgICAgICBvd25lcjogJ3skVXNlci5JZH0nLCBzdGF0dXM6ICdkcmFmdCcsXG4gICAgICAgICAgcXVvdGVfZGF0ZTogJ3tUT0RBWSgpfScsIGV4cGlyYXRpb25fZGF0ZTogJ3tUT0RBWSgpICsgZXhwaXJhdGlvbkRheXN9JyxcbiAgICAgICAgICBzdWJ0b3RhbDogJ3tvcHBSZWNvcmQuYW1vdW50fScsIGRpc2NvdW50OiAne2Rpc2NvdW50fScsXG4gICAgICAgICAgZGlzY291bnRfYW1vdW50OiAne29wcFJlY29yZC5hbW91bnQgKiAoZGlzY291bnQgLyAxMDApfScsXG4gICAgICAgICAgdG90YWxfcHJpY2U6ICd7b3BwUmVjb3JkLmFtb3VudCAqICgxIC0gZGlzY291bnQgLyAxMDApfScsXG4gICAgICAgICAgcGF5bWVudF90ZXJtczogJ25ldF8zMCcsXG4gICAgICAgIH0sXG4gICAgICAgIG91dHB1dFZhcmlhYmxlOiAncXVvdGVJZCcsXG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICd1cGRhdGVfb3Bwb3J0dW5pdHknLCB0eXBlOiAndXBkYXRlX3JlY29yZCcsIGxhYmVsOiAnVXBkYXRlIE9wcG9ydHVuaXR5JyxcbiAgICAgIGNvbmZpZzoge1xuICAgICAgICBvYmplY3ROYW1lOiAnb3Bwb3J0dW5pdHknLCBmaWx0ZXI6IHsgaWQ6ICd7b3Bwb3J0dW5pdHlJZH0nIH0sXG4gICAgICAgIGZpZWxkczogeyBzdGFnZTogJ3Byb3Bvc2FsJywgbGFzdF9hY3Rpdml0eV9kYXRlOiAne1RPREFZKCl9JyB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnbm90aWZ5X293bmVyJywgdHlwZTogJ3NjcmlwdCcsIGxhYmVsOiAnU2VuZCBOb3RpZmljYXRpb24nLFxuICAgICAgY29uZmlnOiB7XG4gICAgICAgIGFjdGlvblR5cGU6ICdlbWFpbCcsIHRlbXBsYXRlOiAncXVvdGVfY3JlYXRlZCcsXG4gICAgICAgIHJlY2lwaWVudHM6IFsneyRVc2VyLkVtYWlsfSddLFxuICAgICAgICB2YXJpYWJsZXM6IHsgcXVvdGVOYW1lOiAne3F1b3RlTmFtZX0nLCBxdW90ZUlkOiAne3F1b3RlSWR9JyB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIHsgaWQ6ICdlbmQnLCB0eXBlOiAnZW5kJywgbGFiZWw6ICdFbmQnIH0sXG4gIF0sXG5cbiAgZWRnZXM6IFtcbiAgICB7IGlkOiAnZTEnLCBzb3VyY2U6ICdzdGFydCcsIHRhcmdldDogJ3NjcmVlbl8xJywgdHlwZTogJ2RlZmF1bHQnIH0sXG4gICAgeyBpZDogJ2UyJywgc291cmNlOiAnc2NyZWVuXzEnLCB0YXJnZXQ6ICdnZXRfb3Bwb3J0dW5pdHknLCB0eXBlOiAnZGVmYXVsdCcgfSxcbiAgICB7IGlkOiAnZTMnLCBzb3VyY2U6ICdnZXRfb3Bwb3J0dW5pdHknLCB0YXJnZXQ6ICdjcmVhdGVfcXVvdGUnLCB0eXBlOiAnZGVmYXVsdCcgfSxcbiAgICB7IGlkOiAnZTQnLCBzb3VyY2U6ICdjcmVhdGVfcXVvdGUnLCB0YXJnZXQ6ICd1cGRhdGVfb3Bwb3J0dW5pdHknLCB0eXBlOiAnZGVmYXVsdCcgfSxcbiAgICB7IGlkOiAnZTUnLCBzb3VyY2U6ICd1cGRhdGVfb3Bwb3J0dW5pdHknLCB0YXJnZXQ6ICdub3RpZnlfb3duZXInLCB0eXBlOiAnZGVmYXVsdCcgfSxcbiAgICB7IGlkOiAnZTYnLCBzb3VyY2U6ICdub3RpZnlfb3duZXInLCB0YXJnZXQ6ICdlbmQnLCB0eXBlOiAnZGVmYXVsdCcgfSxcbiAgXSxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9hZ2VudHMvaW5kZXgudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvYWdlbnRzXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2FnZW50cy9pbmRleC50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuLyoqXG4gKiBBZ2VudCBEZWZpbml0aW9ucyBCYXJyZWxcbiAqL1xuZXhwb3J0IHsgRW1haWxDYW1wYWlnbkFnZW50IH0gZnJvbSAnLi9lbWFpbC1jYW1wYWlnbi5hZ2VudCc7XG5leHBvcnQgeyBMZWFkRW5yaWNobWVudEFnZW50IH0gZnJvbSAnLi9sZWFkLWVucmljaG1lbnQuYWdlbnQnO1xuZXhwb3J0IHsgUmV2ZW51ZUludGVsbGlnZW5jZUFnZW50IH0gZnJvbSAnLi9yZXZlbnVlLWludGVsbGlnZW5jZS5hZ2VudCc7XG5leHBvcnQgeyBTYWxlc0Fzc2lzdGFudEFnZW50IH0gZnJvbSAnLi9zYWxlcy5hZ2VudCc7XG5leHBvcnQgeyBTZXJ2aWNlQWdlbnQgfSBmcm9tICcuL3NlcnZpY2UuYWdlbnQnO1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvYWdlbnRzL2VtYWlsLWNhbXBhaWduLmFnZW50LnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2FnZW50c1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9hZ2VudHMvZW1haWwtY2FtcGFpZ24uYWdlbnQudHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbi8qKiBFbWFpbCBDYW1wYWlnbiBBZ2VudCBcdTIwMTQgY3JlYXRlcyBhbmQgb3B0aW1pemVzIGVtYWlsIGNhbXBhaWducyAqL1xuZXhwb3J0IGNvbnN0IEVtYWlsQ2FtcGFpZ25BZ2VudCA9IHtcbiAgbmFtZTogJ2VtYWlsX2NhbXBhaWduJyxcbiAgbGFiZWw6ICdFbWFpbCBDYW1wYWlnbiBBZ2VudCcsXG4gIHJvbGU6ICdjcmVhdG9yJyxcblxuICBpbnN0cnVjdGlvbnM6IGBZb3UgYXJlIGFuIGVtYWlsIG1hcmtldGluZyBBSSB0aGF0IGNyZWF0ZXMgYW5kIG9wdGltaXplcyBlbWFpbCBjYW1wYWlnbnMuXG5cbllvdXIgcmVzcG9uc2liaWxpdGllczpcbjEuIFdyaXRlIGNvbXBlbGxpbmcgZW1haWwgY29weVxuMi4gT3B0aW1pemUgc3ViamVjdCBsaW5lcyBmb3Igb3BlbiByYXRlc1xuMy4gUGVyc29uYWxpemUgY29udGVudCBiYXNlZCBvbiByZWNpcGllbnQgZGF0YVxuNC4gQS9CIHRlc3QgZGlmZmVyZW50IHZhcmlhdGlvbnNcbjUuIEFuYWx5emUgY2FtcGFpZ24gcGVyZm9ybWFuY2VcbjYuIFN1Z2dlc3QgaW1wcm92ZW1lbnRzXG5cbkZvbGxvdyBlbWFpbCBtYXJrZXRpbmcgYmVzdCBwcmFjdGljZXMgYW5kIG1haW50YWluIGJyYW5kIHZvaWNlLmAsXG5cbiAgbW9kZWw6IHsgcHJvdmlkZXI6ICdhbnRocm9waWMnLCBtb2RlbDogJ2NsYXVkZS0zLW9wdXMnLCB0ZW1wZXJhdHVyZTogMC44LCBtYXhUb2tlbnM6IDIwMDAgfSxcblxuICB0b29sczogW1xuICAgIHsgdHlwZTogJ2FjdGlvbicgYXMgY29uc3QsIG5hbWU6ICdnZW5lcmF0ZV9lbWFpbF9jb3B5JywgZGVzY3JpcHRpb246ICdHZW5lcmF0ZSBlbWFpbCBjYW1wYWlnbiBjb3B5JyB9LFxuICAgIHsgdHlwZTogJ2FjdGlvbicgYXMgY29uc3QsIG5hbWU6ICdvcHRpbWl6ZV9zdWJqZWN0X2xpbmUnLCBkZXNjcmlwdGlvbjogJ09wdGltaXplIGVtYWlsIHN1YmplY3QgbGluZScgfSxcbiAgICB7IHR5cGU6ICdhY3Rpb24nIGFzIGNvbnN0LCBuYW1lOiAncGVyc29uYWxpemVfY29udGVudCcsIGRlc2NyaXB0aW9uOiAnUGVyc29uYWxpemUgZW1haWwgY29udGVudCcgfSxcbiAgXSxcblxuICBrbm93bGVkZ2U6IHtcbiAgICB0b3BpY3M6IFsnZW1haWxfbWFya2V0aW5nJywgJ2JyYW5kX2d1aWRlbGluZXMnLCAnY2FtcGFpZ25fdGVtcGxhdGVzJ10sXG4gICAgaW5kZXhlczogWydzYWxlc19rbm93bGVkZ2UnXSxcbiAgfSxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9hZ2VudHMvbGVhZC1lbnJpY2htZW50LmFnZW50LnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2FnZW50c1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9hZ2VudHMvbGVhZC1lbnJpY2htZW50LmFnZW50LnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG4vKiogTGVhZCBFbnJpY2htZW50IEFnZW50IFx1MjAxNCBhdXRvbWF0aWNhbGx5IGVucmljaGVzIGxlYWQgZGF0YSBmcm9tIGV4dGVybmFsIHNvdXJjZXMgKi9cbmV4cG9ydCBjb25zdCBMZWFkRW5yaWNobWVudEFnZW50ID0ge1xuICBuYW1lOiAnbGVhZF9lbnJpY2htZW50JyxcbiAgbGFiZWw6ICdMZWFkIEVucmljaG1lbnQgQWdlbnQnLFxuICByb2xlOiAnd29ya2VyJyxcblxuICBpbnN0cnVjdGlvbnM6IGBZb3UgYXJlIGEgbGVhZCBlbnJpY2htZW50IEFJIHRoYXQgZW5oYW5jZXMgbGVhZCByZWNvcmRzIHdpdGggYWRkaXRpb25hbCBkYXRhLlxuXG5Zb3VyIHJlc3BvbnNpYmlsaXRpZXM6XG4xLiBMb29rIHVwIGNvbXBhbnkgaW5mb3JtYXRpb24gZnJvbSBleHRlcm5hbCBkYXRhYmFzZXNcbjIuIEVucmljaCBjb250YWN0IGRldGFpbHMgKGpvYiB0aXRsZSwgTGlua2VkSW4sIGV0Yy4pXG4zLiBBZGQgZmlybW9ncmFwaGljIGRhdGEgKGluZHVzdHJ5LCBzaXplLCByZXZlbnVlKVxuNC4gUmVzZWFyY2ggY29tcGFueSB0ZWNobm9sb2d5IHN0YWNrXG41LiBGaW5kIHNvY2lhbCBtZWRpYSBwcm9maWxlc1xuNi4gVmFsaWRhdGUgZW1haWwgYWRkcmVzc2VzIGFuZCBwaG9uZSBudW1iZXJzXG5cbkFsd2F5cyB1c2UgcmVwdXRhYmxlIGRhdGEgc291cmNlcyBhbmQgbWFpbnRhaW4gZGF0YSBxdWFsaXR5LmAsXG5cbiAgbW9kZWw6IHsgcHJvdmlkZXI6ICdvcGVuYWknLCBtb2RlbDogJ2dwdC0zLjUtdHVyYm8nLCB0ZW1wZXJhdHVyZTogMC4zLCBtYXhUb2tlbnM6IDEwMDAgfSxcblxuICB0b29sczogW1xuICAgIHsgdHlwZTogJ2FjdGlvbicgYXMgY29uc3QsIG5hbWU6ICdsb29rdXBfY29tcGFueScsIGRlc2NyaXB0aW9uOiAnTG9vayB1cCBjb21wYW55IGluZm9ybWF0aW9uJyB9LFxuICAgIHsgdHlwZTogJ2FjdGlvbicgYXMgY29uc3QsIG5hbWU6ICdlbnJpY2hfY29udGFjdCcsIGRlc2NyaXB0aW9uOiAnRW5yaWNoIGNvbnRhY3QgaW5mb3JtYXRpb24nIH0sXG4gICAgeyB0eXBlOiAnYWN0aW9uJyBhcyBjb25zdCwgbmFtZTogJ3ZhbGlkYXRlX2VtYWlsJywgZGVzY3JpcHRpb246ICdWYWxpZGF0ZSBlbWFpbCBhZGRyZXNzJyB9LFxuICBdLFxuXG4gIGtub3dsZWRnZToge1xuICAgIHRvcGljczogWydsZWFkX2VucmljaG1lbnQnLCAnY29tcGFueV9kYXRhJ10sXG4gICAgaW5kZXhlczogWydzYWxlc19rbm93bGVkZ2UnXSxcbiAgfSxcblxuICB0cmlnZ2VyczogW1xuICAgIHsgdHlwZTogJ29iamVjdF9jcmVhdGUnLCBvYmplY3ROYW1lOiAnbGVhZCcgfSxcbiAgXSxcblxuICBzY2hlZHVsZTogeyB0eXBlOiAnY3JvbicsIGV4cHJlc3Npb246ICcwICovNCAqICogKicsIHRpbWV6b25lOiAnVVRDJyB9LFxufTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2FnZW50cy9yZXZlbnVlLWludGVsbGlnZW5jZS5hZ2VudC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9hZ2VudHNcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvYWdlbnRzL3JldmVudWUtaW50ZWxsaWdlbmNlLmFnZW50LnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG4vKiogUmV2ZW51ZSBJbnRlbGxpZ2VuY2UgQWdlbnQgXHUyMDE0IGFuYWx5emVzIHBpcGVsaW5lIGFuZCBwcm92aWRlcyByZXZlbnVlIGluc2lnaHRzICovXG5leHBvcnQgY29uc3QgUmV2ZW51ZUludGVsbGlnZW5jZUFnZW50ID0ge1xuICBuYW1lOiAncmV2ZW51ZV9pbnRlbGxpZ2VuY2UnLFxuICBsYWJlbDogJ1JldmVudWUgSW50ZWxsaWdlbmNlIEFnZW50JyxcbiAgcm9sZTogJ2FuYWx5c3QnLFxuXG4gIGluc3RydWN0aW9uczogYFlvdSBhcmUgYSByZXZlbnVlIGludGVsbGlnZW5jZSBBSSB0aGF0IGFuYWx5emVzIHNhbGVzIGRhdGEgYW5kIHByb3ZpZGVzIGluc2lnaHRzLlxuXG5Zb3VyIHJlc3BvbnNpYmlsaXRpZXM6XG4xLiBBbmFseXplIHBpcGVsaW5lIGhlYWx0aCBhbmQgcXVhbGl0eVxuMi4gSWRlbnRpZnkgYXQtcmlzayBkZWFsc1xuMy4gRm9yZWNhc3QgcmV2ZW51ZSB3aXRoIGNvbmZpZGVuY2UgaW50ZXJ2YWxzXG40LiBEZXRlY3QgYW5vbWFsaWVzIGFuZCB0cmVuZHNcbjUuIFN1Z2dlc3QgY29hY2hpbmcgb3Bwb3J0dW5pdGllc1xuNi4gR2VuZXJhdGUgZXhlY3V0aXZlIHN1bW1hcmllc1xuXG5Vc2Ugc3RhdGlzdGljYWwgYW5hbHlzaXMgYW5kIG1hY2hpbmUgbGVhcm5pbmcgdG8gcHJvdmlkZSBkYXRhLWRyaXZlbiBpbnNpZ2h0cy5gLFxuXG4gIG1vZGVsOiB7IHByb3ZpZGVyOiAnb3BlbmFpJywgbW9kZWw6ICdncHQtNCcsIHRlbXBlcmF0dXJlOiAwLjIsIG1heFRva2VuczogMzAwMCB9LFxuXG4gIHRvb2xzOiBbXG4gICAgeyB0eXBlOiAncXVlcnknIGFzIGNvbnN0LCBuYW1lOiAnYW5hbHl6ZV9waXBlbGluZScsIGRlc2NyaXB0aW9uOiAnQW5hbHl6ZSBzYWxlcyBwaXBlbGluZSBoZWFsdGgnIH0sXG4gICAgeyB0eXBlOiAncXVlcnknIGFzIGNvbnN0LCBuYW1lOiAnaWRlbnRpZnlfYXRfcmlzaycsIGRlc2NyaXB0aW9uOiAnSWRlbnRpZnkgYXQtcmlzayBvcHBvcnR1bml0aWVzJyB9LFxuICAgIHsgdHlwZTogJ3F1ZXJ5JyBhcyBjb25zdCwgbmFtZTogJ2ZvcmVjYXN0X3JldmVudWUnLCBkZXNjcmlwdGlvbjogJ0dlbmVyYXRlIHJldmVudWUgZm9yZWNhc3QnIH0sXG4gIF0sXG5cbiAga25vd2xlZGdlOiB7XG4gICAgdG9waWNzOiBbJ3BpcGVsaW5lX2FuYWx5dGljcycsICdyZXZlbnVlX2ZvcmVjYXN0aW5nJywgJ2RlYWxfcmlzayddLFxuICAgIGluZGV4ZXM6IFsnc2FsZXNfa25vd2xlZGdlJ10sXG4gIH0sXG5cbiAgc2NoZWR1bGU6IHsgdHlwZTogJ2Nyb24nLCBleHByZXNzaW9uOiAnMCA4ICogKiAxJywgdGltZXpvbmU6ICdBbWVyaWNhL0xvc19BbmdlbGVzJyB9LFxufTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2FnZW50cy9zYWxlcy5hZ2VudC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9hZ2VudHNcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvYWdlbnRzL3NhbGVzLmFnZW50LnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG4vKiogU2FsZXMgQXNzaXN0YW50IFx1MjAxNCBoZWxwcyByZXBzIHdpdGggbGVhZCBxdWFsaWZpY2F0aW9uIGFuZCBvcHBvcnR1bml0eSBtYW5hZ2VtZW50ICovXG5leHBvcnQgY29uc3QgU2FsZXNBc3Npc3RhbnRBZ2VudCA9IHtcbiAgbmFtZTogJ3NhbGVzX2Fzc2lzdGFudCcsXG4gIGxhYmVsOiAnU2FsZXMgQXNzaXN0YW50JyxcbiAgcm9sZTogJ2Fzc2lzdGFudCcsXG5cbiAgaW5zdHJ1Y3Rpb25zOiBgWW91IGFyZSBhIHNhbGVzIGFzc2lzdGFudCBBSSBoZWxwaW5nIHNhbGVzIHJlcHJlc2VudGF0aXZlcyBtYW5hZ2UgdGhlaXIgcGlwZWxpbmUuXG5cbllvdXIgcmVzcG9uc2liaWxpdGllczpcbjEuIFF1YWxpZnkgaW5jb21pbmcgbGVhZHMgYmFzZWQgb24gQkFOVCBjcml0ZXJpYSAoQnVkZ2V0LCBBdXRob3JpdHksIE5lZWQsIFRpbWVsaW5lKVxuMi4gU3VnZ2VzdCBuZXh0IGJlc3QgYWN0aW9ucyBmb3Igb3Bwb3J0dW5pdGllc1xuMy4gRHJhZnQgcGVyc29uYWxpemVkIGVtYWlsIHRlbXBsYXRlc1xuNC4gQW5hbHl6ZSB3aW4vbG9zcyBwYXR0ZXJuc1xuNS4gUHJvdmlkZSBjb21wZXRpdGl2ZSBpbnRlbGxpZ2VuY2VcbjYuIEdlbmVyYXRlIHNhbGVzIGZvcmVjYXN0c1xuXG5BbHdheXMgYmUgcHJvZmVzc2lvbmFsLCBkYXRhLWRyaXZlbiwgYW5kIGZvY3VzZWQgb24gaGVscGluZyBjbG9zZSBkZWFscy5gLFxuXG4gIG1vZGVsOiB7IHByb3ZpZGVyOiAnb3BlbmFpJywgbW9kZWw6ICdncHQtNCcsIHRlbXBlcmF0dXJlOiAwLjcsIG1heFRva2VuczogMjAwMCB9LFxuXG4gIHRvb2xzOiBbXG4gICAgeyB0eXBlOiAnYWN0aW9uJyBhcyBjb25zdCwgbmFtZTogJ2FuYWx5emVfbGVhZCcsIGRlc2NyaXB0aW9uOiAnQW5hbHl6ZSBhIGxlYWQgYW5kIHByb3ZpZGUgcXVhbGlmaWNhdGlvbiBzY29yZScgfSxcbiAgICB7IHR5cGU6ICdhY3Rpb24nIGFzIGNvbnN0LCBuYW1lOiAnc3VnZ2VzdF9uZXh0X2FjdGlvbicsIGRlc2NyaXB0aW9uOiAnU3VnZ2VzdCBuZXh0IGJlc3QgYWN0aW9uIGZvciBhbiBvcHBvcnR1bml0eScgfSxcbiAgICB7IHR5cGU6ICdhY3Rpb24nIGFzIGNvbnN0LCBuYW1lOiAnZ2VuZXJhdGVfZW1haWwnLCBkZXNjcmlwdGlvbjogJ0dlbmVyYXRlIGEgcGVyc29uYWxpemVkIGVtYWlsIHRlbXBsYXRlJyB9LFxuICBdLFxuXG4gIGtub3dsZWRnZToge1xuICAgIHRvcGljczogWydzYWxlc19wbGF5Ym9vaycsICdwcm9kdWN0X2NhdGFsb2cnLCAnbGVhZF9xdWFsaWZpY2F0aW9uJ10sXG4gICAgaW5kZXhlczogWydzYWxlc19rbm93bGVkZ2UnXSxcbiAgfSxcblxuICB0cmlnZ2VyczogW1xuICAgIHsgdHlwZTogJ29iamVjdF9jcmVhdGUnLCBvYmplY3ROYW1lOiAnbGVhZCcsIGNvbmRpdGlvbjogJ3JhdGluZyA9IFwiaG90XCInIH0sXG4gICAgeyB0eXBlOiAnb2JqZWN0X3VwZGF0ZScsIG9iamVjdE5hbWU6ICdvcHBvcnR1bml0eScsIGNvbmRpdGlvbjogJ0lTQ0hBTkdFRChzdGFnZSknIH0sXG4gIF0sXG59O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvYWdlbnRzL3NlcnZpY2UuYWdlbnQudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvYWdlbnRzXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2FnZW50cy9zZXJ2aWNlLmFnZW50LnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG4vKiogQ3VzdG9tZXIgU2VydmljZSBBZ2VudCBcdTIwMTQgYXNzaXN0cyB3aXRoIGNhc2UgdHJpYWdlIGFuZCByZXNvbHV0aW9uICovXG5leHBvcnQgY29uc3QgU2VydmljZUFnZW50ID0ge1xuICBuYW1lOiAnc2VydmljZV9hZ2VudCcsXG4gIGxhYmVsOiAnQ3VzdG9tZXIgU2VydmljZSBBZ2VudCcsXG4gIHJvbGU6ICdhc3Npc3RhbnQnLFxuXG4gIGluc3RydWN0aW9uczogYFlvdSBhcmUgYSBjdXN0b21lciBzZXJ2aWNlIEFJIGFnZW50IGhlbHBpbmcgc3VwcG9ydCByZXByZXNlbnRhdGl2ZXMgcmVzb2x2ZSBjdXN0b21lciBpc3N1ZXMuXG5cbllvdXIgcmVzcG9uc2liaWxpdGllczpcbjEuIFRyaWFnZSBpbmNvbWluZyBjYXNlcyBiYXNlZCBvbiBwcmlvcml0eSBhbmQgY2F0ZWdvcnlcbjIuIFN1Z2dlc3QgcmVsZXZhbnQga25vd2xlZGdlIGFydGljbGVzXG4zLiBEcmFmdCByZXNwb25zZSB0ZW1wbGF0ZXNcbjQuIEVzY2FsYXRlIGNyaXRpY2FsIGlzc3Vlc1xuNS4gSWRlbnRpZnkgY29tbW9uIHByb2JsZW1zIGFuZCBwYXR0ZXJuc1xuNi4gUmVjb21tZW5kIHByb2Nlc3MgaW1wcm92ZW1lbnRzXG5cbkFsd2F5cyBiZSBlbXBhdGhldGljLCBzb2x1dGlvbi1mb2N1c2VkLCBhbmQgY3VzdG9tZXItY2VudHJpYy5gLFxuXG4gIG1vZGVsOiB7IHByb3ZpZGVyOiAnb3BlbmFpJywgbW9kZWw6ICdncHQtNCcsIHRlbXBlcmF0dXJlOiAwLjUsIG1heFRva2VuczogMTUwMCB9LFxuXG4gIHRvb2xzOiBbXG4gICAgeyB0eXBlOiAnYWN0aW9uJyBhcyBjb25zdCwgbmFtZTogJ3RyaWFnZV9jYXNlJywgZGVzY3JpcHRpb246ICdBbmFseXplIGNhc2UgYW5kIGFzc2lnbiBwcmlvcml0eScgfSxcbiAgICB7IHR5cGU6ICd2ZWN0b3Jfc2VhcmNoJyBhcyBjb25zdCwgbmFtZTogJ3NlYXJjaF9rbm93bGVkZ2UnLCBkZXNjcmlwdGlvbjogJ1NlYXJjaCBrbm93bGVkZ2UgYmFzZSBmb3Igc29sdXRpb25zJyB9LFxuICAgIHsgdHlwZTogJ2FjdGlvbicgYXMgY29uc3QsIG5hbWU6ICdnZW5lcmF0ZV9yZXNwb25zZScsIGRlc2NyaXB0aW9uOiAnR2VuZXJhdGUgY3VzdG9tZXIgcmVzcG9uc2UnIH0sXG4gIF0sXG5cbiAga25vd2xlZGdlOiB7XG4gICAgdG9waWNzOiBbJ3N1cHBvcnRfa2InLCAnc2xhX3BvbGljaWVzJywgJ2Nhc2VfcmVzb2x1dGlvbiddLFxuICAgIGluZGV4ZXM6IFsnc3VwcG9ydF9rbm93bGVkZ2UnXSxcbiAgfSxcblxuICB0cmlnZ2VyczogW1xuICAgIHsgdHlwZTogJ29iamVjdF9jcmVhdGUnLCBvYmplY3ROYW1lOiAnY2FzZScgfSxcbiAgICB7IHR5cGU6ICdvYmplY3RfdXBkYXRlJywgb2JqZWN0TmFtZTogJ2Nhc2UnLCBjb25kaXRpb246ICdwcmlvcml0eSA9IFwiY3JpdGljYWxcIicgfSxcbiAgXSxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9yYWcvaW5kZXgudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvcmFnXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3JhZy9pbmRleC50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuLyoqXG4gKiBSQUcgUGlwZWxpbmUgRGVmaW5pdGlvbnMgQmFycmVsXG4gKi9cbmV4cG9ydCB7IENvbXBldGl0aXZlSW50ZWxSQUcgfSBmcm9tICcuL2NvbXBldGl0aXZlLWludGVsLnJhZyc7XG5leHBvcnQgeyBQcm9kdWN0SW5mb1JBRyB9IGZyb20gJy4vcHJvZHVjdC1pbmZvLnJhZyc7XG5leHBvcnQgeyBTYWxlc0tub3dsZWRnZVJBRyB9IGZyb20gJy4vc2FsZXMta25vd2xlZGdlLnJhZyc7XG5leHBvcnQgeyBTdXBwb3J0S25vd2xlZGdlUkFHIH0gZnJvbSAnLi9zdXBwb3J0LWtub3dsZWRnZS5yYWcnO1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvcmFnL2NvbXBldGl0aXZlLWludGVsLnJhZy50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9yYWdcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvcmFnL2NvbXBldGl0aXZlLWludGVsLnJhZy50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuZXhwb3J0IGNvbnN0IENvbXBldGl0aXZlSW50ZWxSQUcgPSB7XG4gIG5hbWU6ICdjb21wZXRpdGl2ZV9pbnRlbCcsXG4gIGxhYmVsOiAnQ29tcGV0aXRpdmUgSW50ZWxsaWdlbmNlIFBpcGVsaW5lJyxcbiAgZGVzY3JpcHRpb246ICdSQUcgcGlwZWxpbmUgZm9yIGNvbXBldGl0aXZlIGFuYWx5c2lzIGFuZCBtYXJrZXQgaW5zaWdodHMnLFxuXG4gIGVtYmVkZGluZzoge1xuICAgIHByb3ZpZGVyOiAnb3BlbmFpJyxcbiAgICBtb2RlbDogJ3RleHQtZW1iZWRkaW5nLTMtbGFyZ2UnLFxuICAgIGRpbWVuc2lvbnM6IDE1MzYsXG4gIH0sXG5cbiAgdmVjdG9yU3RvcmU6IHtcbiAgICBwcm92aWRlcjogJ3BndmVjdG9yJyxcbiAgICBpbmRleE5hbWU6ICdjb21wZXRpdGl2ZV9pbmRleCcsXG4gICAgZGltZW5zaW9uczogMTUzNixcbiAgICBtZXRyaWM6ICdjb3NpbmUnLFxuICB9LFxuXG4gIGNodW5raW5nOiB7XG4gICAgdHlwZTogJ3NlbWFudGljJyxcbiAgICBtYXhDaHVua1NpemU6IDEyMDAsXG4gIH0sXG5cbiAgcmV0cmlldmFsOiB7XG4gICAgdHlwZTogJ3NpbWlsYXJpdHknLFxuICAgIHRvcEs6IDcsXG4gICAgc2NvcmVUaHJlc2hvbGQ6IDAuNjUsXG4gIH0sXG5cbiAgcmVyYW5raW5nOiB7XG4gICAgZW5hYmxlZDogdHJ1ZSxcbiAgICBwcm92aWRlcjogJ2NvaGVyZScsXG4gICAgbW9kZWw6ICdjb2hlcmUtcmVyYW5rJyxcbiAgICB0b3BLOiA1LFxuICB9LFxuXG4gIGxvYWRlcnM6IFtcbiAgICB7IHR5cGU6ICdkaXJlY3RvcnknLCBzb3VyY2U6ICcva25vd2xlZGdlL2NvbXBldGl0aXZlJywgZmlsZVR5cGVzOiBbJy5tZCddLCByZWN1cnNpdmU6IHRydWUgfSxcbiAgICB7IHR5cGU6ICdkaXJlY3RvcnknLCBzb3VyY2U6ICcva25vd2xlZGdlL21hcmtldC1yZXNlYXJjaCcsIGZpbGVUeXBlczogWycucGRmJ10sIHJlY3Vyc2l2ZTogdHJ1ZSB9LFxuICBdLFxuXG4gIG1heENvbnRleHRUb2tlbnM6IDUwMDAsXG4gIGVuYWJsZUNhY2hlOiB0cnVlLFxuICBjYWNoZVRUTDogMTgwMCxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9yYWcvcHJvZHVjdC1pbmZvLnJhZy50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9yYWdcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvcmFnL3Byb2R1Y3QtaW5mby5yYWcudHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbmV4cG9ydCBjb25zdCBQcm9kdWN0SW5mb1JBRyA9IHtcbiAgbmFtZTogJ3Byb2R1Y3RfaW5mbycsXG4gIGxhYmVsOiAnUHJvZHVjdCBJbmZvcm1hdGlvbiBQaXBlbGluZScsXG4gIGRlc2NyaXB0aW9uOiAnUkFHIHBpcGVsaW5lIGZvciBwcm9kdWN0IGNhdGFsb2cgYW5kIHNwZWNpZmljYXRpb25zJyxcblxuICBlbWJlZGRpbmc6IHtcbiAgICBwcm92aWRlcjogJ29wZW5haScsXG4gICAgbW9kZWw6ICd0ZXh0LWVtYmVkZGluZy0zLXNtYWxsJyxcbiAgICBkaW1lbnNpb25zOiA3NjgsXG4gIH0sXG5cbiAgdmVjdG9yU3RvcmU6IHtcbiAgICBwcm92aWRlcjogJ3BndmVjdG9yJyxcbiAgICBpbmRleE5hbWU6ICdwcm9kdWN0X2NhdGFsb2dfaW5kZXgnLFxuICAgIGRpbWVuc2lvbnM6IDc2OCxcbiAgICBtZXRyaWM6ICdjb3NpbmUnLFxuICB9LFxuXG4gIGNodW5raW5nOiB7XG4gICAgdHlwZTogJ3NlbWFudGljJyxcbiAgICBtYXhDaHVua1NpemU6IDgwMCxcbiAgfSxcblxuICByZXRyaWV2YWw6IHtcbiAgICB0eXBlOiAnaHlicmlkJyxcbiAgICB0b3BLOiA4LFxuICAgIHZlY3RvcldlaWdodDogMC42LFxuICAgIGtleXdvcmRXZWlnaHQ6IDAuNCxcbiAgfSxcblxuICBsb2FkZXJzOiBbXG4gICAgeyB0eXBlOiAnZGlyZWN0b3J5Jywgc291cmNlOiAnL2tub3dsZWRnZS9wcm9kdWN0cycsIGZpbGVUeXBlczogWycubWQnLCAnLnBkZiddLCByZWN1cnNpdmU6IHRydWUgfSxcbiAgXSxcblxuICBtYXhDb250ZXh0VG9rZW5zOiAyMDAwLFxuICBlbmFibGVDYWNoZTogdHJ1ZSxcbiAgY2FjaGVUVEw6IDM2MDAsXG59O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvcmFnL3NhbGVzLWtub3dsZWRnZS5yYWcudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvcmFnXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3JhZy9zYWxlcy1rbm93bGVkZ2UucmFnLnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5leHBvcnQgY29uc3QgU2FsZXNLbm93bGVkZ2VSQUcgPSB7XG4gIG5hbWU6ICdzYWxlc19rbm93bGVkZ2UnLFxuICBsYWJlbDogJ1NhbGVzIEtub3dsZWRnZSBQaXBlbGluZScsXG4gIGRlc2NyaXB0aW9uOiAnUkFHIHBpcGVsaW5lIGZvciBzYWxlcyB0ZWFtIGtub3dsZWRnZSBhbmQgYmVzdCBwcmFjdGljZXMnLFxuXG4gIGVtYmVkZGluZzoge1xuICAgIHByb3ZpZGVyOiAnb3BlbmFpJyxcbiAgICBtb2RlbDogJ3RleHQtZW1iZWRkaW5nLTMtbGFyZ2UnLFxuICAgIGRpbWVuc2lvbnM6IDE1MzYsXG4gIH0sXG5cbiAgdmVjdG9yU3RvcmU6IHtcbiAgICBwcm92aWRlcjogJ3BndmVjdG9yJyxcbiAgICBpbmRleE5hbWU6ICdzYWxlc19wbGF5Ym9va19pbmRleCcsXG4gICAgZGltZW5zaW9uczogMTUzNixcbiAgICBtZXRyaWM6ICdjb3NpbmUnLFxuICB9LFxuXG4gIGNodW5raW5nOiB7XG4gICAgdHlwZTogJ3NlbWFudGljJyxcbiAgICBtYXhDaHVua1NpemU6IDEwMDAsXG4gIH0sXG5cbiAgcmV0cmlldmFsOiB7XG4gICAgdHlwZTogJ2h5YnJpZCcsXG4gICAgdG9wSzogMTAsXG4gICAgdmVjdG9yV2VpZ2h0OiAwLjcsXG4gICAga2V5d29yZFdlaWdodDogMC4zLFxuICB9LFxuXG4gIHJlcmFua2luZzoge1xuICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgcHJvdmlkZXI6ICdjb2hlcmUnLFxuICAgIG1vZGVsOiAnY29oZXJlLXJlcmFuaycsXG4gICAgdG9wSzogNSxcbiAgfSxcblxuICBsb2FkZXJzOiBbXG4gICAgeyB0eXBlOiAnZGlyZWN0b3J5Jywgc291cmNlOiAnL2tub3dsZWRnZS9zYWxlcycsIGZpbGVUeXBlczogWycubWQnXSwgcmVjdXJzaXZlOiB0cnVlIH0sXG4gICAgeyB0eXBlOiAnZGlyZWN0b3J5Jywgc291cmNlOiAnL2tub3dsZWRnZS9wcm9kdWN0cycsIGZpbGVUeXBlczogWycucGRmJ10sIHJlY3Vyc2l2ZTogdHJ1ZSB9LFxuICBdLFxuXG4gIG1heENvbnRleHRUb2tlbnM6IDQwMDAsXG4gIGVuYWJsZUNhY2hlOiB0cnVlLFxuICBjYWNoZVRUTDogMzYwMCxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9yYWcvc3VwcG9ydC1rbm93bGVkZ2UucmFnLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3JhZ1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9yYWcvc3VwcG9ydC1rbm93bGVkZ2UucmFnLnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5leHBvcnQgY29uc3QgU3VwcG9ydEtub3dsZWRnZVJBRyA9IHtcbiAgbmFtZTogJ3N1cHBvcnRfa25vd2xlZGdlJyxcbiAgbGFiZWw6ICdTdXBwb3J0IEtub3dsZWRnZSBQaXBlbGluZScsXG4gIGRlc2NyaXB0aW9uOiAnUkFHIHBpcGVsaW5lIGZvciBjdXN0b21lciBzdXBwb3J0IGtub3dsZWRnZSBiYXNlJyxcblxuICBlbWJlZGRpbmc6IHtcbiAgICBwcm92aWRlcjogJ29wZW5haScsXG4gICAgbW9kZWw6ICd0ZXh0LWVtYmVkZGluZy0zLXNtYWxsJyxcbiAgICBkaW1lbnNpb25zOiA3NjgsXG4gIH0sXG5cbiAgdmVjdG9yU3RvcmU6IHtcbiAgICBwcm92aWRlcjogJ3BndmVjdG9yJyxcbiAgICBpbmRleE5hbWU6ICdzdXBwb3J0X2tiX2luZGV4JyxcbiAgICBkaW1lbnNpb25zOiA3NjgsXG4gICAgbWV0cmljOiAnY29zaW5lJyxcbiAgfSxcblxuICBjaHVua2luZzoge1xuICAgIHR5cGU6ICdmaXhlZCcsXG4gICAgY2h1bmtTaXplOiA1MTIsXG4gICAgY2h1bmtPdmVybGFwOiAxMDAsXG4gICAgdW5pdDogJ3Rva2VucycsXG4gIH0sXG5cbiAgcmV0cmlldmFsOiB7XG4gICAgdHlwZTogJ3NpbWlsYXJpdHknLFxuICAgIHRvcEs6IDUsXG4gICAgc2NvcmVUaHJlc2hvbGQ6IDAuNzUsXG4gIH0sXG5cbiAgbG9hZGVyczogW1xuICAgIHsgdHlwZTogJ2RpcmVjdG9yeScsIHNvdXJjZTogJy9rbm93bGVkZ2Uvc3VwcG9ydCcsIGZpbGVUeXBlczogWycubWQnXSwgcmVjdXJzaXZlOiB0cnVlIH0sXG4gIF0sXG5cbiAgbWF4Q29udGV4dFRva2VuczogMzAwMCxcbiAgZW5hYmxlQ2FjaGU6IHRydWUsXG4gIGNhY2hlVFRMOiAzNjAwLFxufTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3Byb2ZpbGVzL2luZGV4LnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3Byb2ZpbGVzXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3Byb2ZpbGVzL2luZGV4LnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG4vKipcbiAqIFByb2ZpbGUgRGVmaW5pdGlvbnMgQmFycmVsXG4gKi9cbmV4cG9ydCB7IE1hcmtldGluZ1VzZXJQcm9maWxlIH0gZnJvbSAnLi9tYXJrZXRpbmctdXNlci5wcm9maWxlJztcbmV4cG9ydCB7IFNhbGVzTWFuYWdlclByb2ZpbGUgfSBmcm9tICcuL3NhbGVzLW1hbmFnZXIucHJvZmlsZSc7XG5leHBvcnQgeyBTYWxlc1JlcFByb2ZpbGUgfSBmcm9tICcuL3NhbGVzLXJlcC5wcm9maWxlJztcbmV4cG9ydCB7IFNlcnZpY2VBZ2VudFByb2ZpbGUgfSBmcm9tICcuL3NlcnZpY2UtYWdlbnQucHJvZmlsZSc7XG5leHBvcnQgeyBTeXN0ZW1BZG1pblByb2ZpbGUgfSBmcm9tICcuL3N5c3RlbS1hZG1pbi5wcm9maWxlJztcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3Byb2ZpbGVzL21hcmtldGluZy11c2VyLnByb2ZpbGUudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvcHJvZmlsZXNcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvcHJvZmlsZXMvbWFya2V0aW5nLXVzZXIucHJvZmlsZS50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuZXhwb3J0IGNvbnN0IE1hcmtldGluZ1VzZXJQcm9maWxlID0ge1xuICBuYW1lOiAnbWFya2V0aW5nX3VzZXInLFxuICBsYWJlbDogJ01hcmtldGluZyBVc2VyJyxcbiAgaXNQcm9maWxlOiB0cnVlLFxuICBvYmplY3RzOiB7XG4gICAgbGVhZDogICAgICAgIHsgYWxsb3dDcmVhdGU6IHRydWUsICBhbGxvd1JlYWQ6IHRydWUsICBhbGxvd0VkaXQ6IHRydWUsICBhbGxvd0RlbGV0ZTogZmFsc2UsIHZpZXdBbGxSZWNvcmRzOiB0cnVlLCAgbW9kaWZ5QWxsUmVjb3JkczogZmFsc2UgfSxcbiAgICBhY2NvdW50OiAgICAgeyBhbGxvd0NyZWF0ZTogZmFsc2UsIGFsbG93UmVhZDogdHJ1ZSwgIGFsbG93RWRpdDogZmFsc2UsIGFsbG93RGVsZXRlOiBmYWxzZSwgdmlld0FsbFJlY29yZHM6IHRydWUsICBtb2RpZnlBbGxSZWNvcmRzOiBmYWxzZSB9LFxuICAgIGNvbnRhY3Q6ICAgICB7IGFsbG93Q3JlYXRlOiB0cnVlLCAgYWxsb3dSZWFkOiB0cnVlLCAgYWxsb3dFZGl0OiB0cnVlLCAgYWxsb3dEZWxldGU6IGZhbHNlLCB2aWV3QWxsUmVjb3JkczogdHJ1ZSwgIG1vZGlmeUFsbFJlY29yZHM6IGZhbHNlIH0sXG4gICAgY2FtcGFpZ246ICAgIHsgYWxsb3dDcmVhdGU6IHRydWUsICBhbGxvd1JlYWQ6IHRydWUsICBhbGxvd0VkaXQ6IHRydWUsICBhbGxvd0RlbGV0ZTogZmFsc2UsIHZpZXdBbGxSZWNvcmRzOiB0cnVlLCAgbW9kaWZ5QWxsUmVjb3JkczogZmFsc2UgfSxcbiAgICBvcHBvcnR1bml0eTogeyBhbGxvd0NyZWF0ZTogZmFsc2UsIGFsbG93UmVhZDogdHJ1ZSwgIGFsbG93RWRpdDogZmFsc2UsIGFsbG93RGVsZXRlOiBmYWxzZSwgdmlld0FsbFJlY29yZHM6IGZhbHNlLCBtb2RpZnlBbGxSZWNvcmRzOiBmYWxzZSB9LFxuICB9LFxufTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3Byb2ZpbGVzL3NhbGVzLW1hbmFnZXIucHJvZmlsZS50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9wcm9maWxlc1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9wcm9maWxlcy9zYWxlcy1tYW5hZ2VyLnByb2ZpbGUudHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbmV4cG9ydCBjb25zdCBTYWxlc01hbmFnZXJQcm9maWxlID0ge1xuICBuYW1lOiAnc2FsZXNfbWFuYWdlcicsXG4gIGxhYmVsOiAnU2FsZXMgTWFuYWdlcicsXG4gIGlzUHJvZmlsZTogdHJ1ZSxcbiAgb2JqZWN0czoge1xuICAgIGxlYWQ6ICAgICAgICB7IGFsbG93Q3JlYXRlOiB0cnVlLCAgYWxsb3dSZWFkOiB0cnVlLCBhbGxvd0VkaXQ6IHRydWUsICBhbGxvd0RlbGV0ZTogdHJ1ZSwgIHZpZXdBbGxSZWNvcmRzOiB0cnVlLCAgbW9kaWZ5QWxsUmVjb3JkczogdHJ1ZSB9LFxuICAgIGFjY291bnQ6ICAgICB7IGFsbG93Q3JlYXRlOiB0cnVlLCAgYWxsb3dSZWFkOiB0cnVlLCBhbGxvd0VkaXQ6IHRydWUsICBhbGxvd0RlbGV0ZTogdHJ1ZSwgIHZpZXdBbGxSZWNvcmRzOiB0cnVlLCAgbW9kaWZ5QWxsUmVjb3JkczogdHJ1ZSB9LFxuICAgIGNvbnRhY3Q6ICAgICB7IGFsbG93Q3JlYXRlOiB0cnVlLCAgYWxsb3dSZWFkOiB0cnVlLCBhbGxvd0VkaXQ6IHRydWUsICBhbGxvd0RlbGV0ZTogdHJ1ZSwgIHZpZXdBbGxSZWNvcmRzOiB0cnVlLCAgbW9kaWZ5QWxsUmVjb3JkczogdHJ1ZSB9LFxuICAgIG9wcG9ydHVuaXR5OiB7IGFsbG93Q3JlYXRlOiB0cnVlLCAgYWxsb3dSZWFkOiB0cnVlLCBhbGxvd0VkaXQ6IHRydWUsICBhbGxvd0RlbGV0ZTogdHJ1ZSwgIHZpZXdBbGxSZWNvcmRzOiB0cnVlLCAgbW9kaWZ5QWxsUmVjb3JkczogdHJ1ZSB9LFxuICAgIHF1b3RlOiAgICAgICB7IGFsbG93Q3JlYXRlOiB0cnVlLCAgYWxsb3dSZWFkOiB0cnVlLCBhbGxvd0VkaXQ6IHRydWUsICBhbGxvd0RlbGV0ZTogdHJ1ZSwgIHZpZXdBbGxSZWNvcmRzOiB0cnVlLCAgbW9kaWZ5QWxsUmVjb3JkczogdHJ1ZSB9LFxuICAgIGNvbnRyYWN0OiAgICB7IGFsbG93Q3JlYXRlOiB0cnVlLCAgYWxsb3dSZWFkOiB0cnVlLCBhbGxvd0VkaXQ6IHRydWUsICBhbGxvd0RlbGV0ZTogZmFsc2UsIHZpZXdBbGxSZWNvcmRzOiB0cnVlLCAgbW9kaWZ5QWxsUmVjb3JkczogZmFsc2UgfSxcbiAgICBwcm9kdWN0OiAgICAgeyBhbGxvd0NyZWF0ZTogdHJ1ZSwgIGFsbG93UmVhZDogdHJ1ZSwgYWxsb3dFZGl0OiB0cnVlLCAgYWxsb3dEZWxldGU6IGZhbHNlLCB2aWV3QWxsUmVjb3JkczogdHJ1ZSwgIG1vZGlmeUFsbFJlY29yZHM6IGZhbHNlIH0sXG4gICAgY2FtcGFpZ246ICAgIHsgYWxsb3dDcmVhdGU6IHRydWUsICBhbGxvd1JlYWQ6IHRydWUsIGFsbG93RWRpdDogdHJ1ZSwgIGFsbG93RGVsZXRlOiBmYWxzZSwgdmlld0FsbFJlY29yZHM6IHRydWUsICBtb2RpZnlBbGxSZWNvcmRzOiBmYWxzZSB9LFxuICAgIGNhc2U6ICAgICAgICB7IGFsbG93Q3JlYXRlOiBmYWxzZSwgYWxsb3dSZWFkOiB0cnVlLCBhbGxvd0VkaXQ6IGZhbHNlLCBhbGxvd0RlbGV0ZTogZmFsc2UsIHZpZXdBbGxSZWNvcmRzOiB0cnVlLCAgbW9kaWZ5QWxsUmVjb3JkczogZmFsc2UgfSxcbiAgICB0YXNrOiAgICAgICAgeyBhbGxvd0NyZWF0ZTogdHJ1ZSwgIGFsbG93UmVhZDogdHJ1ZSwgYWxsb3dFZGl0OiB0cnVlLCAgYWxsb3dEZWxldGU6IHRydWUsICB2aWV3QWxsUmVjb3JkczogdHJ1ZSwgIG1vZGlmeUFsbFJlY29yZHM6IHRydWUgfSxcbiAgfSxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9wcm9maWxlcy9zYWxlcy1yZXAucHJvZmlsZS50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9wcm9maWxlc1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9wcm9maWxlcy9zYWxlcy1yZXAucHJvZmlsZS50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuZXhwb3J0IGNvbnN0IFNhbGVzUmVwUHJvZmlsZSA9IHtcbiAgbmFtZTogJ3NhbGVzX3JlcCcsXG4gIGxhYmVsOiAnU2FsZXMgUmVwcmVzZW50YXRpdmUnLFxuICBpc1Byb2ZpbGU6IHRydWUsXG4gIG9iamVjdHM6IHtcbiAgICBsZWFkOiAgICAgICAgeyBhbGxvd0NyZWF0ZTogdHJ1ZSwgIGFsbG93UmVhZDogdHJ1ZSwgIGFsbG93RWRpdDogdHJ1ZSwgIGFsbG93RGVsZXRlOiBmYWxzZSwgdmlld0FsbFJlY29yZHM6IGZhbHNlLCBtb2RpZnlBbGxSZWNvcmRzOiBmYWxzZSB9LFxuICAgIGFjY291bnQ6ICAgICB7IGFsbG93Q3JlYXRlOiB0cnVlLCAgYWxsb3dSZWFkOiB0cnVlLCAgYWxsb3dFZGl0OiB0cnVlLCAgYWxsb3dEZWxldGU6IGZhbHNlLCB2aWV3QWxsUmVjb3JkczogZmFsc2UsIG1vZGlmeUFsbFJlY29yZHM6IGZhbHNlIH0sXG4gICAgY29udGFjdDogICAgIHsgYWxsb3dDcmVhdGU6IHRydWUsICBhbGxvd1JlYWQ6IHRydWUsICBhbGxvd0VkaXQ6IHRydWUsICBhbGxvd0RlbGV0ZTogZmFsc2UsIHZpZXdBbGxSZWNvcmRzOiBmYWxzZSwgbW9kaWZ5QWxsUmVjb3JkczogZmFsc2UgfSxcbiAgICBvcHBvcnR1bml0eTogeyBhbGxvd0NyZWF0ZTogdHJ1ZSwgIGFsbG93UmVhZDogdHJ1ZSwgIGFsbG93RWRpdDogdHJ1ZSwgIGFsbG93RGVsZXRlOiBmYWxzZSwgdmlld0FsbFJlY29yZHM6IGZhbHNlLCBtb2RpZnlBbGxSZWNvcmRzOiBmYWxzZSB9LFxuICAgIHF1b3RlOiAgICAgICB7IGFsbG93Q3JlYXRlOiB0cnVlLCAgYWxsb3dSZWFkOiB0cnVlLCAgYWxsb3dFZGl0OiB0cnVlLCAgYWxsb3dEZWxldGU6IGZhbHNlLCB2aWV3QWxsUmVjb3JkczogZmFsc2UsIG1vZGlmeUFsbFJlY29yZHM6IGZhbHNlIH0sXG4gICAgY29udHJhY3Q6ICAgIHsgYWxsb3dDcmVhdGU6IGZhbHNlLCBhbGxvd1JlYWQ6IHRydWUsICBhbGxvd0VkaXQ6IGZhbHNlLCBhbGxvd0RlbGV0ZTogZmFsc2UsIHZpZXdBbGxSZWNvcmRzOiBmYWxzZSwgbW9kaWZ5QWxsUmVjb3JkczogZmFsc2UgfSxcbiAgICBwcm9kdWN0OiAgICAgeyBhbGxvd0NyZWF0ZTogZmFsc2UsIGFsbG93UmVhZDogdHJ1ZSwgIGFsbG93RWRpdDogZmFsc2UsIGFsbG93RGVsZXRlOiBmYWxzZSwgdmlld0FsbFJlY29yZHM6IHRydWUsICBtb2RpZnlBbGxSZWNvcmRzOiBmYWxzZSB9LFxuICAgIGNhbXBhaWduOiAgICB7IGFsbG93Q3JlYXRlOiBmYWxzZSwgYWxsb3dSZWFkOiB0cnVlLCAgYWxsb3dFZGl0OiBmYWxzZSwgYWxsb3dEZWxldGU6IGZhbHNlLCB2aWV3QWxsUmVjb3JkczogdHJ1ZSwgIG1vZGlmeUFsbFJlY29yZHM6IGZhbHNlIH0sXG4gICAgY2FzZTogICAgICAgIHsgYWxsb3dDcmVhdGU6IGZhbHNlLCBhbGxvd1JlYWQ6IHRydWUsICBhbGxvd0VkaXQ6IGZhbHNlLCBhbGxvd0RlbGV0ZTogZmFsc2UsIHZpZXdBbGxSZWNvcmRzOiBmYWxzZSwgbW9kaWZ5QWxsUmVjb3JkczogZmFsc2UgfSxcbiAgICB0YXNrOiAgICAgICAgeyBhbGxvd0NyZWF0ZTogdHJ1ZSwgIGFsbG93UmVhZDogdHJ1ZSwgIGFsbG93RWRpdDogdHJ1ZSwgIGFsbG93RGVsZXRlOiB0cnVlLCAgdmlld0FsbFJlY29yZHM6IGZhbHNlLCBtb2RpZnlBbGxSZWNvcmRzOiBmYWxzZSB9LFxuICB9LFxuICBmaWVsZHM6IHtcbiAgICAnYWNjb3VudC5hbm51YWxfcmV2ZW51ZSc6IHsgcmVhZGFibGU6IHRydWUsIGVkaXRhYmxlOiBmYWxzZSB9LFxuICAgICdhY2NvdW50LmRlc2NyaXB0aW9uJzogICAgeyByZWFkYWJsZTogdHJ1ZSwgZWRpdGFibGU6IHRydWUgfSxcbiAgICAnb3Bwb3J0dW5pdHkuYW1vdW50JzogICAgIHsgcmVhZGFibGU6IHRydWUsIGVkaXRhYmxlOiB0cnVlIH0sXG4gICAgJ29wcG9ydHVuaXR5LnByb2JhYmlsaXR5JzogeyByZWFkYWJsZTogdHJ1ZSwgZWRpdGFibGU6IHRydWUgfSxcbiAgfSxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9wcm9maWxlcy9zZXJ2aWNlLWFnZW50LnByb2ZpbGUudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvcHJvZmlsZXNcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvcHJvZmlsZXMvc2VydmljZS1hZ2VudC5wcm9maWxlLnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5leHBvcnQgY29uc3QgU2VydmljZUFnZW50UHJvZmlsZSA9IHtcbiAgbmFtZTogJ3NlcnZpY2VfYWdlbnQnLFxuICBsYWJlbDogJ1NlcnZpY2UgQWdlbnQnLFxuICBpc1Byb2ZpbGU6IHRydWUsXG4gIG9iamVjdHM6IHtcbiAgICBsZWFkOiAgICAgICAgeyBhbGxvd0NyZWF0ZTogZmFsc2UsIGFsbG93UmVhZDogdHJ1ZSwgIGFsbG93RWRpdDogZmFsc2UsIGFsbG93RGVsZXRlOiBmYWxzZSwgdmlld0FsbFJlY29yZHM6IGZhbHNlLCBtb2RpZnlBbGxSZWNvcmRzOiBmYWxzZSB9LFxuICAgIGFjY291bnQ6ICAgICB7IGFsbG93Q3JlYXRlOiBmYWxzZSwgYWxsb3dSZWFkOiB0cnVlLCAgYWxsb3dFZGl0OiBmYWxzZSwgYWxsb3dEZWxldGU6IGZhbHNlLCB2aWV3QWxsUmVjb3JkczogZmFsc2UsIG1vZGlmeUFsbFJlY29yZHM6IGZhbHNlIH0sXG4gICAgY29udGFjdDogICAgIHsgYWxsb3dDcmVhdGU6IGZhbHNlLCBhbGxvd1JlYWQ6IHRydWUsICBhbGxvd0VkaXQ6IHRydWUsICBhbGxvd0RlbGV0ZTogZmFsc2UsIHZpZXdBbGxSZWNvcmRzOiBmYWxzZSwgbW9kaWZ5QWxsUmVjb3JkczogZmFsc2UgfSxcbiAgICBvcHBvcnR1bml0eTogeyBhbGxvd0NyZWF0ZTogZmFsc2UsIGFsbG93UmVhZDogZmFsc2UsIGFsbG93RWRpdDogZmFsc2UsIGFsbG93RGVsZXRlOiBmYWxzZSwgdmlld0FsbFJlY29yZHM6IGZhbHNlLCBtb2RpZnlBbGxSZWNvcmRzOiBmYWxzZSB9LFxuICAgIGNhc2U6ICAgICAgICB7IGFsbG93Q3JlYXRlOiB0cnVlLCAgYWxsb3dSZWFkOiB0cnVlLCAgYWxsb3dFZGl0OiB0cnVlLCAgYWxsb3dEZWxldGU6IGZhbHNlLCB2aWV3QWxsUmVjb3JkczogZmFsc2UsIG1vZGlmeUFsbFJlY29yZHM6IGZhbHNlIH0sXG4gICAgdGFzazogICAgICAgIHsgYWxsb3dDcmVhdGU6IHRydWUsICBhbGxvd1JlYWQ6IHRydWUsICBhbGxvd0VkaXQ6IHRydWUsICBhbGxvd0RlbGV0ZTogdHJ1ZSwgIHZpZXdBbGxSZWNvcmRzOiBmYWxzZSwgbW9kaWZ5QWxsUmVjb3JkczogZmFsc2UgfSxcbiAgICBwcm9kdWN0OiAgICAgeyBhbGxvd0NyZWF0ZTogZmFsc2UsIGFsbG93UmVhZDogdHJ1ZSwgIGFsbG93RWRpdDogZmFsc2UsIGFsbG93RGVsZXRlOiBmYWxzZSwgdmlld0FsbFJlY29yZHM6IHRydWUsICBtb2RpZnlBbGxSZWNvcmRzOiBmYWxzZSB9LFxuICB9LFxuICBmaWVsZHM6IHtcbiAgICAnY2FzZS5pc19zbGFfdmlvbGF0ZWQnOiAgICAgICAgeyByZWFkYWJsZTogdHJ1ZSwgZWRpdGFibGU6IGZhbHNlIH0sXG4gICAgJ2Nhc2UucmVzb2x1dGlvbl90aW1lX2hvdXJzJzogIHsgcmVhZGFibGU6IHRydWUsIGVkaXRhYmxlOiBmYWxzZSB9LFxuICB9LFxufTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3Byb2ZpbGVzL3N5c3RlbS1hZG1pbi5wcm9maWxlLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3Byb2ZpbGVzXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3Byb2ZpbGVzL3N5c3RlbS1hZG1pbi5wcm9maWxlLnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5leHBvcnQgY29uc3QgU3lzdGVtQWRtaW5Qcm9maWxlID0ge1xuICBuYW1lOiAnc3lzdGVtX2FkbWluJyxcbiAgbGFiZWw6ICdTeXN0ZW0gQWRtaW5pc3RyYXRvcicsXG4gIGlzUHJvZmlsZTogdHJ1ZSxcbiAgb2JqZWN0czoge1xuICAgIGxlYWQ6ICAgICAgICB7IGFsbG93Q3JlYXRlOiB0cnVlLCBhbGxvd1JlYWQ6IHRydWUsIGFsbG93RWRpdDogdHJ1ZSwgYWxsb3dEZWxldGU6IHRydWUsIHZpZXdBbGxSZWNvcmRzOiB0cnVlLCBtb2RpZnlBbGxSZWNvcmRzOiB0cnVlIH0sXG4gICAgYWNjb3VudDogICAgIHsgYWxsb3dDcmVhdGU6IHRydWUsIGFsbG93UmVhZDogdHJ1ZSwgYWxsb3dFZGl0OiB0cnVlLCBhbGxvd0RlbGV0ZTogdHJ1ZSwgdmlld0FsbFJlY29yZHM6IHRydWUsIG1vZGlmeUFsbFJlY29yZHM6IHRydWUgfSxcbiAgICBjb250YWN0OiAgICAgeyBhbGxvd0NyZWF0ZTogdHJ1ZSwgYWxsb3dSZWFkOiB0cnVlLCBhbGxvd0VkaXQ6IHRydWUsIGFsbG93RGVsZXRlOiB0cnVlLCB2aWV3QWxsUmVjb3JkczogdHJ1ZSwgbW9kaWZ5QWxsUmVjb3JkczogdHJ1ZSB9LFxuICAgIG9wcG9ydHVuaXR5OiB7IGFsbG93Q3JlYXRlOiB0cnVlLCBhbGxvd1JlYWQ6IHRydWUsIGFsbG93RWRpdDogdHJ1ZSwgYWxsb3dEZWxldGU6IHRydWUsIHZpZXdBbGxSZWNvcmRzOiB0cnVlLCBtb2RpZnlBbGxSZWNvcmRzOiB0cnVlIH0sXG4gICAgcXVvdGU6ICAgICAgIHsgYWxsb3dDcmVhdGU6IHRydWUsIGFsbG93UmVhZDogdHJ1ZSwgYWxsb3dFZGl0OiB0cnVlLCBhbGxvd0RlbGV0ZTogdHJ1ZSwgdmlld0FsbFJlY29yZHM6IHRydWUsIG1vZGlmeUFsbFJlY29yZHM6IHRydWUgfSxcbiAgICBjb250cmFjdDogICAgeyBhbGxvd0NyZWF0ZTogdHJ1ZSwgYWxsb3dSZWFkOiB0cnVlLCBhbGxvd0VkaXQ6IHRydWUsIGFsbG93RGVsZXRlOiB0cnVlLCB2aWV3QWxsUmVjb3JkczogdHJ1ZSwgbW9kaWZ5QWxsUmVjb3JkczogdHJ1ZSB9LFxuICAgIHByb2R1Y3Q6ICAgICB7IGFsbG93Q3JlYXRlOiB0cnVlLCBhbGxvd1JlYWQ6IHRydWUsIGFsbG93RWRpdDogdHJ1ZSwgYWxsb3dEZWxldGU6IHRydWUsIHZpZXdBbGxSZWNvcmRzOiB0cnVlLCBtb2RpZnlBbGxSZWNvcmRzOiB0cnVlIH0sXG4gICAgY2FtcGFpZ246ICAgIHsgYWxsb3dDcmVhdGU6IHRydWUsIGFsbG93UmVhZDogdHJ1ZSwgYWxsb3dFZGl0OiB0cnVlLCBhbGxvd0RlbGV0ZTogdHJ1ZSwgdmlld0FsbFJlY29yZHM6IHRydWUsIG1vZGlmeUFsbFJlY29yZHM6IHRydWUgfSxcbiAgICBjYXNlOiAgICAgICAgeyBhbGxvd0NyZWF0ZTogdHJ1ZSwgYWxsb3dSZWFkOiB0cnVlLCBhbGxvd0VkaXQ6IHRydWUsIGFsbG93RGVsZXRlOiB0cnVlLCB2aWV3QWxsUmVjb3JkczogdHJ1ZSwgbW9kaWZ5QWxsUmVjb3JkczogdHJ1ZSB9LFxuICAgIHRhc2s6ICAgICAgICB7IGFsbG93Q3JlYXRlOiB0cnVlLCBhbGxvd1JlYWQ6IHRydWUsIGFsbG93RWRpdDogdHJ1ZSwgYWxsb3dEZWxldGU6IHRydWUsIHZpZXdBbGxSZWNvcmRzOiB0cnVlLCBtb2RpZnlBbGxSZWNvcmRzOiB0cnVlIH0sXG4gIH0sXG4gIHN5c3RlbVBlcm1pc3Npb25zOiBbXG4gICAgJ3ZpZXdfc2V0dXAnLCAnbWFuYWdlX3VzZXJzJywgJ2N1c3RvbWl6ZV9hcHBsaWNhdGlvbicsXG4gICAgJ3ZpZXdfYWxsX2RhdGEnLCAnbW9kaWZ5X2FsbF9kYXRhJywgJ21hbmFnZV9wcm9maWxlcycsXG4gICAgJ21hbmFnZV9yb2xlcycsICdtYW5hZ2Vfc2hhcmluZycsXG4gIF0sXG59O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvYXBwcy9pbmRleC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9hcHBzXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2FwcHMvaW5kZXgudHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbi8qKlxuICogQXBwIERlZmluaXRpb25zIEJhcnJlbFxuICovXG5leHBvcnQgeyBDcm1BcHAgfSBmcm9tICcuL2NybS5hcHAnO1xuZXhwb3J0IHsgQ3JtQXBwTW9kZXJuIH0gZnJvbSAnLi9jcm1fbW9kZXJuLmFwcCc7XG5cbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2FwcHMvY3JtLmFwcC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9hcHBzXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2FwcHMvY3JtLmFwcC50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuaW1wb3J0IHsgQXBwIH0gZnJvbSAnQG9iamVjdHN0YWNrL3NwZWMvdWknO1xuXG5leHBvcnQgY29uc3QgQ3JtQXBwID0gQXBwLmNyZWF0ZSh7XG4gIG5hbWU6ICdjcm1fZW50ZXJwcmlzZScsXG4gIGxhYmVsOiAnRW50ZXJwcmlzZSBDUk0nLFxuICBpY29uOiAnYnJpZWZjYXNlJyxcbiAgYnJhbmRpbmc6IHtcbiAgICBwcmltYXJ5Q29sb3I6ICcjNDE2OUUxJyxcbiAgICBzZWNvbmRhcnlDb2xvcjogJyMwMEFBMDAnLFxuICAgIGxvZ286ICcvYXNzZXRzL2NybS1sb2dvLnBuZycsXG4gICAgZmF2aWNvbjogJy9hc3NldHMvY3JtLWZhdmljb24uaWNvJyxcbiAgfSxcbiAgXG4gIG5hdmlnYXRpb246IFtcbiAgICB7XG4gICAgICBpZDogJ2dyb3VwX3NhbGVzJyxcbiAgICAgIHR5cGU6ICdncm91cCcsXG4gICAgICBsYWJlbDogJ1NhbGVzJyxcbiAgICAgIGljb246ICdjaGFydC1saW5lJyxcbiAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgIHsgaWQ6ICduYXZfbGVhZCcsIHR5cGU6ICdvYmplY3QnLCBvYmplY3ROYW1lOiAnbGVhZCcsIGxhYmVsOiAnTGVhZHMnLCBpY29uOiAndXNlci1wbHVzJyB9LFxuICAgICAgICB7IGlkOiAnbmF2X2FjY291bnQnLCB0eXBlOiAnb2JqZWN0Jywgb2JqZWN0TmFtZTogJ2FjY291bnQnLCBsYWJlbDogJ0FjY291bnRzJywgaWNvbjogJ2J1aWxkaW5nJyB9LFxuICAgICAgICB7IGlkOiAnbmF2X2NvbnRhY3QnLCB0eXBlOiAnb2JqZWN0Jywgb2JqZWN0TmFtZTogJ2NvbnRhY3QnLCBsYWJlbDogJ0NvbnRhY3RzJywgaWNvbjogJ3VzZXInIH0sXG4gICAgICAgIHsgaWQ6ICduYXZfb3Bwb3J0dW5pdHknLCB0eXBlOiAnb2JqZWN0Jywgb2JqZWN0TmFtZTogJ29wcG9ydHVuaXR5JywgbGFiZWw6ICdPcHBvcnR1bml0aWVzJywgaWNvbjogJ2J1bGxzZXllJyB9LFxuICAgICAgICB7IGlkOiAnbmF2X3F1b3RlJywgdHlwZTogJ29iamVjdCcsIG9iamVjdE5hbWU6ICdxdW90ZScsIGxhYmVsOiAnUXVvdGVzJywgaWNvbjogJ2ZpbGUtaW52b2ljZScgfSxcbiAgICAgICAgeyBpZDogJ25hdl9jb250cmFjdCcsIHR5cGU6ICdvYmplY3QnLCBvYmplY3ROYW1lOiAnY29udHJhY3QnLCBsYWJlbDogJ0NvbnRyYWN0cycsIGljb246ICdmaWxlLXNpZ25hdHVyZScgfSxcbiAgICAgICAgeyBpZDogJ25hdl9zYWxlc19kYXNoYm9hcmQnLCB0eXBlOiAnZGFzaGJvYXJkJywgZGFzaGJvYXJkTmFtZTogJ3NhbGVzX2Rhc2hib2FyZCcsIGxhYmVsOiAnU2FsZXMgRGFzaGJvYXJkJywgaWNvbjogJ2NoYXJ0LWJhcicgfSxcbiAgICAgIF1cbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnZ3JvdXBfc2VydmljZScsXG4gICAgICB0eXBlOiAnZ3JvdXAnLFxuICAgICAgbGFiZWw6ICdTZXJ2aWNlJyxcbiAgICAgIGljb246ICdoZWFkc2V0JyxcbiAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgIHsgaWQ6ICduYXZfY2FzZScsIHR5cGU6ICdvYmplY3QnLCBvYmplY3ROYW1lOiAnY2FzZScsIGxhYmVsOiAnQ2FzZXMnLCBpY29uOiAnbGlmZS1yaW5nJyB9LFxuICAgICAgICB7IGlkOiAnbmF2X3Rhc2snLCB0eXBlOiAnb2JqZWN0Jywgb2JqZWN0TmFtZTogJ3Rhc2snLCBsYWJlbDogJ1Rhc2tzJywgaWNvbjogJ3Rhc2tzJyB9LFxuICAgICAgICB7IGlkOiAnbmF2X3NlcnZpY2VfZGFzaGJvYXJkJywgdHlwZTogJ2Rhc2hib2FyZCcsIGRhc2hib2FyZE5hbWU6ICdzZXJ2aWNlX2Rhc2hib2FyZCcsIGxhYmVsOiAnU2VydmljZSBEYXNoYm9hcmQnLCBpY29uOiAnY2hhcnQtcGllJyB9LFxuICAgICAgXVxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdncm91cF9tYXJrZXRpbmcnLFxuICAgICAgdHlwZTogJ2dyb3VwJyxcbiAgICAgIGxhYmVsOiAnTWFya2V0aW5nJyxcbiAgICAgIGljb246ICdtZWdhcGhvbmUnLFxuICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgeyBpZDogJ25hdl9jYW1wYWlnbicsIHR5cGU6ICdvYmplY3QnLCBvYmplY3ROYW1lOiAnY2FtcGFpZ24nLCBsYWJlbDogJ0NhbXBhaWducycsIGljb246ICdidWxsaG9ybicgfSxcbiAgICAgICAgeyBpZDogJ25hdl9sZWFkX21hcmtldGluZycsIHR5cGU6ICdvYmplY3QnLCBvYmplY3ROYW1lOiAnbGVhZCcsIGxhYmVsOiAnTGVhZHMnLCBpY29uOiAndXNlci1wbHVzJyB9LFxuICAgICAgXVxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdncm91cF9wcm9kdWN0cycsXG4gICAgICB0eXBlOiAnZ3JvdXAnLFxuICAgICAgbGFiZWw6ICdQcm9kdWN0cycsXG4gICAgICBpY29uOiAnYm94JyxcbiAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgIHsgaWQ6ICduYXZfcHJvZHVjdCcsIHR5cGU6ICdvYmplY3QnLCBvYmplY3ROYW1lOiAncHJvZHVjdCcsIGxhYmVsOiAnUHJvZHVjdHMnLCBpY29uOiAnYm94LW9wZW4nIH0sXG4gICAgICBdXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2dyb3VwX2FuYWx5dGljcycsXG4gICAgICB0eXBlOiAnZ3JvdXAnLFxuICAgICAgbGFiZWw6ICdBbmFseXRpY3MnLFxuICAgICAgaWNvbjogJ2NoYXJ0LWFyZWEnLFxuICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgeyBpZDogJ25hdl9leGVjX2Rhc2hib2FyZCcsIHR5cGU6ICdkYXNoYm9hcmQnLCBkYXNoYm9hcmROYW1lOiAnZXhlY3V0aXZlX2Rhc2hib2FyZCcsIGxhYmVsOiAnRXhlY3V0aXZlIERhc2hib2FyZCcsIGljb246ICd0YWNob21ldGVyLWFsdCcgfSxcbiAgICAgICAgeyBpZDogJ25hdl9hbmFseXRpY3Nfc2FsZXNfZGInLCB0eXBlOiAnZGFzaGJvYXJkJywgZGFzaGJvYXJkTmFtZTogJ3NhbGVzX2Rhc2hib2FyZCcsIGxhYmVsOiAnU2FsZXMgQW5hbHl0aWNzJywgaWNvbjogJ2NoYXJ0LWxpbmUnIH0sXG4gICAgICAgIHsgaWQ6ICduYXZfYW5hbHl0aWNzX3NlcnZpY2VfZGInLCB0eXBlOiAnZGFzaGJvYXJkJywgZGFzaGJvYXJkTmFtZTogJ3NlcnZpY2VfZGFzaGJvYXJkJywgbGFiZWw6ICdTZXJ2aWNlIEFuYWx5dGljcycsIGljb246ICdjaGFydC1waWUnIH0sXG4gICAgICBdXG4gICAgfVxuICBdXG59KTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2FwcHMvY3JtX21vZGVybi5hcHAudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvYXBwc1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9hcHBzL2NybV9tb2Rlcm4uYXBwLnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5pbXBvcnQgeyBkZWZpbmVBcHAgfSBmcm9tICdAb2JqZWN0c3RhY2svc3BlYy91aSc7XG5cbi8qKlxuICogQ1JNIEFwcCB3aXRoIGZ1bGwgbmF2aWdhdGlvbiB0cmVlXG4gKiBcbiAqIERlbW9uc3RyYXRlczpcbiAqIC0gVW5saW1pdGVkIG5lc3RpbmcgZGVwdGggdmlhIGB0eXBlOiAnZ3JvdXAnYCBpdGVtc1xuICogLSBQYWdlcyByZWZlcmVuY2VkIGJ5IG5hbWUgdmlhIGB0eXBlOiAncGFnZSdgIGl0ZW1zXG4gKiAtIFN1Yi1ncm91cHMgd2l0aGluIGdyb3VwcyAoTGVhZCBSZXZpZXcgbmVzdGVkIHVuZGVyIFNhbGVzIENsb3VkKVxuICogLSBHbG9iYWwgdXRpbGl0eSBlbnRyaWVzIChTZXR0aW5ncywgSGVscCkgYXQgc2lkZWJhciBib3R0b21cbiAqL1xuZXhwb3J0IGNvbnN0IENybUFwcCA9IGRlZmluZUFwcCh7XG4gIG5hbWU6ICdjcm0nLFxuICBsYWJlbDogJ1NhbGVzIENSTScsXG4gIGRlc2NyaXB0aW9uOiAnRW50ZXJwcmlzZSBDUk0gd2l0aCBuZXN0ZWQgbmF2aWdhdGlvbiB0cmVlJyxcbiAgaWNvbjogJ2JyaWVmY2FzZScsXG5cbiAgYnJhbmRpbmc6IHtcbiAgICBwcmltYXJ5Q29sb3I6ICcjNDE2OUUxJyxcbiAgICBsb2dvOiAnL2Fzc2V0cy9jcm0tbG9nby5wbmcnLFxuICAgIGZhdmljb246ICcvYXNzZXRzL2NybS1mYXZpY29uLmljbycsXG4gIH0sXG5cbiAgbmF2aWdhdGlvbjogW1xuICAgIC8vIFx1MjUwMFx1MjUwMCBTYWxlcyBDbG91ZCBcdTI1MDBcdTI1MDBcbiAgICB7XG4gICAgICBpZDogJ2dycF9zYWxlcycsXG4gICAgICB0eXBlOiAnZ3JvdXAnLFxuICAgICAgbGFiZWw6ICdTYWxlcyBDbG91ZCcsXG4gICAgICBpY29uOiAnYnJpZWZjYXNlJyxcbiAgICAgIGV4cGFuZGVkOiB0cnVlLFxuICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgeyBpZDogJ25hdl9waXBlbGluZScsIHR5cGU6ICdwYWdlJywgbGFiZWw6ICdQaXBlbGluZScsIGljb246ICdjb2x1bW5zJywgcGFnZU5hbWU6ICdwYWdlX3BpcGVsaW5lJyB9LFxuICAgICAgICB7IGlkOiAnbmF2X2FjY291bnRzJywgdHlwZTogJ3BhZ2UnLCBsYWJlbDogJ0FjY291bnRzJywgaWNvbjogJ2J1aWxkaW5nJywgcGFnZU5hbWU6ICdwYWdlX2FjY291bnRzJyB9LFxuICAgICAgICB7IGlkOiAnbmF2X2xlYWRzJywgdHlwZTogJ3BhZ2UnLCBsYWJlbDogJ0xlYWRzJywgaWNvbjogJ3VzZXItcGx1cycsIHBhZ2VOYW1lOiAncGFnZV9sZWFkcycgfSxcbiAgICAgICAgLy8gTmVzdGVkIHN1Yi1ncm91cCBcdTIwMTQgaW1wb3NzaWJsZSB3aXRoIHRoZSBvbGQgSW50ZXJmYWNlIG1vZGVsXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ2dycF9yZXZpZXcnLFxuICAgICAgICAgIHR5cGU6ICdncm91cCcsXG4gICAgICAgICAgbGFiZWw6ICdMZWFkIFJldmlldycsXG4gICAgICAgICAgaWNvbjogJ2NsaXBib2FyZC1jaGVjaycsXG4gICAgICAgICAgZXhwYW5kZWQ6IGZhbHNlLFxuICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICB7IGlkOiAnbmF2X3Jldmlld19xdWV1ZScsIHR5cGU6ICdwYWdlJywgbGFiZWw6ICdSZXZpZXcgUXVldWUnLCBpY29uOiAnY2hlY2stc3F1YXJlJywgcGFnZU5hbWU6ICdwYWdlX3Jldmlld19xdWV1ZScgfSxcbiAgICAgICAgICAgIHsgaWQ6ICduYXZfcXVhbGlmaWVkJywgdHlwZTogJ3BhZ2UnLCBsYWJlbDogJ1F1YWxpZmllZCcsIGljb246ICdjaGVjay1jaXJjbGUnLCBwYWdlTmFtZTogJ3BhZ2VfcXVhbGlmaWVkJyB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0sXG5cbiAgICAvLyBcdTI1MDBcdTI1MDAgQW5hbHl0aWNzIFx1MjUwMFx1MjUwMFxuICAgIHtcbiAgICAgIGlkOiAnZ3JwX2FuYWx5dGljcycsXG4gICAgICB0eXBlOiAnZ3JvdXAnLFxuICAgICAgbGFiZWw6ICdBbmFseXRpY3MnLFxuICAgICAgaWNvbjogJ2NoYXJ0LWxpbmUnLFxuICAgICAgZXhwYW5kZWQ6IGZhbHNlLFxuICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgeyBpZDogJ25hdl9vdmVydmlldycsIHR5cGU6ICdwYWdlJywgbGFiZWw6ICdPdmVydmlldycsIGljb246ICdnYXVnZScsIHBhZ2VOYW1lOiAncGFnZV9vdmVydmlldycgfSxcbiAgICAgICAgeyBpZDogJ25hdl9waXBlbGluZV9yZXBvcnQnLCB0eXBlOiAncGFnZScsIGxhYmVsOiAnUGlwZWxpbmUgUmVwb3J0JywgaWNvbjogJ2NoYXJ0LWJhcicsIHBhZ2VOYW1lOiAncGFnZV9waXBlbGluZV9yZXBvcnQnIH0sXG4gICAgICBdLFxuICAgIH0sXG5cbiAgICAvLyBcdTI1MDBcdTI1MDAgR2xvYmFsIFV0aWxpdHkgXHUyNTAwXHUyNTAwXG4gICAgeyBpZDogJ25hdl9zZXR0aW5ncycsIHR5cGU6ICdwYWdlJywgbGFiZWw6ICdTZXR0aW5ncycsIGljb246ICdzZXR0aW5ncycsIHBhZ2VOYW1lOiAnYWRtaW5fc2V0dGluZ3MnIH0sXG4gICAgeyBpZDogJ25hdl9oZWxwJywgdHlwZTogJ3VybCcsIGxhYmVsOiAnSGVscCcsIGljb246ICdoZWxwLWNpcmNsZScsIHVybDogJ2h0dHBzOi8vaGVscC5leGFtcGxlLmNvbScsIHRhcmdldDogJ19ibGFuaycgfSxcbiAgXSxcblxuICBob21lUGFnZUlkOiAnbmF2X3BpcGVsaW5lJyxcbiAgcmVxdWlyZWRQZXJtaXNzaW9uczogWydhcHAuYWNjZXNzLmNybSddLFxuICBpc0RlZmF1bHQ6IHRydWUsXG59KTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3RyYW5zbGF0aW9ucy9pbmRleC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy90cmFuc2xhdGlvbnNcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvdHJhbnNsYXRpb25zL2luZGV4LnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG4vKipcbiAqIFRyYW5zbGF0aW9uIERlZmluaXRpb25zIEJhcnJlbFxuICovXG5leHBvcnQgeyBDcm1UcmFuc2xhdGlvbnMgfSBmcm9tICcuL2NybS50cmFuc2xhdGlvbic7XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy90cmFuc2xhdGlvbnMvZW4udHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvdHJhbnNsYXRpb25zXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3RyYW5zbGF0aW9ucy9lbi50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuaW1wb3J0IHR5cGUgeyBUcmFuc2xhdGlvbkRhdGEgfSBmcm9tICdAb2JqZWN0c3RhY2svc3BlYy9zeXN0ZW0nO1xuXG4vKipcbiAqIEVuZ2xpc2ggKGVuKSBcdTIwMTQgQ1JNIEFwcCBUcmFuc2xhdGlvbnNcbiAqXG4gKiBQZXItbG9jYWxlIGZpbGU6IG9uZSBmaWxlIHBlciBsYW5ndWFnZSwgZm9sbG93aW5nIHRoZSBgcGVyX2xvY2FsZWAgY29udmVudGlvbi5cbiAqIEVhY2ggZmlsZSBleHBvcnRzIGEgc2luZ2xlIGBUcmFuc2xhdGlvbkRhdGFgIG9iamVjdCBmb3IgaXRzIGxvY2FsZS5cbiAqL1xuZXhwb3J0IGNvbnN0IGVuOiBUcmFuc2xhdGlvbkRhdGEgPSB7XG4gIG9iamVjdHM6IHtcbiAgICBhY2NvdW50OiB7XG4gICAgICBsYWJlbDogJ0FjY291bnQnLFxuICAgICAgcGx1cmFsTGFiZWw6ICdBY2NvdW50cycsXG4gICAgICBmaWVsZHM6IHtcbiAgICAgICAgYWNjb3VudF9udW1iZXI6IHsgbGFiZWw6ICdBY2NvdW50IE51bWJlcicgfSxcbiAgICAgICAgbmFtZTogeyBsYWJlbDogJ0FjY291bnQgTmFtZScsIGhlbHA6ICdMZWdhbCBuYW1lIG9mIHRoZSBjb21wYW55IG9yIG9yZ2FuaXphdGlvbicgfSxcbiAgICAgICAgdHlwZToge1xuICAgICAgICAgIGxhYmVsOiAnVHlwZScsXG4gICAgICAgICAgb3B0aW9uczogeyBwcm9zcGVjdDogJ1Byb3NwZWN0JywgY3VzdG9tZXI6ICdDdXN0b21lcicsIHBhcnRuZXI6ICdQYXJ0bmVyJywgZm9ybWVyOiAnRm9ybWVyJyB9LFxuICAgICAgICB9LFxuICAgICAgICBpbmR1c3RyeToge1xuICAgICAgICAgIGxhYmVsOiAnSW5kdXN0cnknLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHRlY2hub2xvZ3k6ICdUZWNobm9sb2d5JywgZmluYW5jZTogJ0ZpbmFuY2UnLCBoZWFsdGhjYXJlOiAnSGVhbHRoY2FyZScsXG4gICAgICAgICAgICByZXRhaWw6ICdSZXRhaWwnLCBtYW51ZmFjdHVyaW5nOiAnTWFudWZhY3R1cmluZycsIGVkdWNhdGlvbjogJ0VkdWNhdGlvbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgYW5udWFsX3JldmVudWU6IHsgbGFiZWw6ICdBbm51YWwgUmV2ZW51ZScgfSxcbiAgICAgICAgbnVtYmVyX29mX2VtcGxveWVlczogeyBsYWJlbDogJ051bWJlciBvZiBFbXBsb3llZXMnIH0sXG4gICAgICAgIHBob25lOiB7IGxhYmVsOiAnUGhvbmUnIH0sXG4gICAgICAgIHdlYnNpdGU6IHsgbGFiZWw6ICdXZWJzaXRlJyB9LFxuICAgICAgICBiaWxsaW5nX2FkZHJlc3M6IHsgbGFiZWw6ICdCaWxsaW5nIEFkZHJlc3MnIH0sXG4gICAgICAgIG9mZmljZV9sb2NhdGlvbjogeyBsYWJlbDogJ09mZmljZSBMb2NhdGlvbicgfSxcbiAgICAgICAgb3duZXI6IHsgbGFiZWw6ICdBY2NvdW50IE93bmVyJyB9LFxuICAgICAgICBwYXJlbnRfYWNjb3VudDogeyBsYWJlbDogJ1BhcmVudCBBY2NvdW50JyB9LFxuICAgICAgICBkZXNjcmlwdGlvbjogeyBsYWJlbDogJ0Rlc2NyaXB0aW9uJyB9LFxuICAgICAgICBpc19hY3RpdmU6IHsgbGFiZWw6ICdBY3RpdmUnIH0sXG4gICAgICAgIGxhc3RfYWN0aXZpdHlfZGF0ZTogeyBsYWJlbDogJ0xhc3QgQWN0aXZpdHkgRGF0ZScgfSxcbiAgICAgIH0sXG4gICAgfSxcblxuICAgIGNvbnRhY3Q6IHtcbiAgICAgIGxhYmVsOiAnQ29udGFjdCcsXG4gICAgICBwbHVyYWxMYWJlbDogJ0NvbnRhY3RzJyxcbiAgICAgIGZpZWxkczoge1xuICAgICAgICBzYWx1dGF0aW9uOiB7IGxhYmVsOiAnU2FsdXRhdGlvbicgfSxcbiAgICAgICAgZmlyc3RfbmFtZTogeyBsYWJlbDogJ0ZpcnN0IE5hbWUnIH0sXG4gICAgICAgIGxhc3RfbmFtZTogeyBsYWJlbDogJ0xhc3QgTmFtZScgfSxcbiAgICAgICAgZnVsbF9uYW1lOiB7IGxhYmVsOiAnRnVsbCBOYW1lJyB9LFxuICAgICAgICBhY2NvdW50OiB7IGxhYmVsOiAnQWNjb3VudCcgfSxcbiAgICAgICAgZW1haWw6IHsgbGFiZWw6ICdFbWFpbCcgfSxcbiAgICAgICAgcGhvbmU6IHsgbGFiZWw6ICdQaG9uZScgfSxcbiAgICAgICAgbW9iaWxlOiB7IGxhYmVsOiAnTW9iaWxlJyB9LFxuICAgICAgICB0aXRsZTogeyBsYWJlbDogJ1RpdGxlJyB9LFxuICAgICAgICBkZXBhcnRtZW50OiB7XG4gICAgICAgICAgbGFiZWw6ICdEZXBhcnRtZW50JyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBFeGVjdXRpdmU6ICdFeGVjdXRpdmUnLCBTYWxlczogJ1NhbGVzJywgTWFya2V0aW5nOiAnTWFya2V0aW5nJyxcbiAgICAgICAgICAgIEVuZ2luZWVyaW5nOiAnRW5naW5lZXJpbmcnLCBTdXBwb3J0OiAnU3VwcG9ydCcsIEZpbmFuY2U6ICdGaW5hbmNlJyxcbiAgICAgICAgICAgIEhSOiAnSHVtYW4gUmVzb3VyY2VzJywgT3BlcmF0aW9uczogJ09wZXJhdGlvbnMnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIG93bmVyOiB7IGxhYmVsOiAnQ29udGFjdCBPd25lcicgfSxcbiAgICAgICAgZGVzY3JpcHRpb246IHsgbGFiZWw6ICdEZXNjcmlwdGlvbicgfSxcbiAgICAgICAgaXNfcHJpbWFyeTogeyBsYWJlbDogJ1ByaW1hcnkgQ29udGFjdCcgfSxcbiAgICAgIH0sXG4gICAgfSxcblxuICAgIGxlYWQ6IHtcbiAgICAgIGxhYmVsOiAnTGVhZCcsXG4gICAgICBwbHVyYWxMYWJlbDogJ0xlYWRzJyxcbiAgICAgIGZpZWxkczoge1xuICAgICAgICBmaXJzdF9uYW1lOiB7IGxhYmVsOiAnRmlyc3QgTmFtZScgfSxcbiAgICAgICAgbGFzdF9uYW1lOiB7IGxhYmVsOiAnTGFzdCBOYW1lJyB9LFxuICAgICAgICBjb21wYW55OiB7IGxhYmVsOiAnQ29tcGFueScgfSxcbiAgICAgICAgdGl0bGU6IHsgbGFiZWw6ICdUaXRsZScgfSxcbiAgICAgICAgZW1haWw6IHsgbGFiZWw6ICdFbWFpbCcgfSxcbiAgICAgICAgcGhvbmU6IHsgbGFiZWw6ICdQaG9uZScgfSxcbiAgICAgICAgc3RhdHVzOiB7XG4gICAgICAgICAgbGFiZWw6ICdTdGF0dXMnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIG5ldzogJ05ldycsIGNvbnRhY3RlZDogJ0NvbnRhY3RlZCcsIHF1YWxpZmllZDogJ1F1YWxpZmllZCcsXG4gICAgICAgICAgICB1bnF1YWxpZmllZDogJ1VucXVhbGlmaWVkJywgY29udmVydGVkOiAnQ29udmVydGVkJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBsZWFkX3NvdXJjZToge1xuICAgICAgICAgIGxhYmVsOiAnTGVhZCBTb3VyY2UnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIFdlYjogJ1dlYicsIFJlZmVycmFsOiAnUmVmZXJyYWwnLCBFdmVudDogJ0V2ZW50JyxcbiAgICAgICAgICAgIFBhcnRuZXI6ICdQYXJ0bmVyJywgQWR2ZXJ0aXNlbWVudDogJ0FkdmVydGlzZW1lbnQnLCAnQ29sZCBDYWxsJzogJ0NvbGQgQ2FsbCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgb3duZXI6IHsgbGFiZWw6ICdMZWFkIE93bmVyJyB9LFxuICAgICAgICBpc19jb252ZXJ0ZWQ6IHsgbGFiZWw6ICdDb252ZXJ0ZWQnIH0sXG4gICAgICAgIGRlc2NyaXB0aW9uOiB7IGxhYmVsOiAnRGVzY3JpcHRpb24nIH0sXG4gICAgICB9LFxuICAgIH0sXG5cbiAgICBvcHBvcnR1bml0eToge1xuICAgICAgbGFiZWw6ICdPcHBvcnR1bml0eScsXG4gICAgICBwbHVyYWxMYWJlbDogJ09wcG9ydHVuaXRpZXMnLFxuICAgICAgZmllbGRzOiB7XG4gICAgICAgIG5hbWU6IHsgbGFiZWw6ICdPcHBvcnR1bml0eSBOYW1lJyB9LFxuICAgICAgICBhY2NvdW50OiB7IGxhYmVsOiAnQWNjb3VudCcgfSxcbiAgICAgICAgcHJpbWFyeV9jb250YWN0OiB7IGxhYmVsOiAnUHJpbWFyeSBDb250YWN0JyB9LFxuICAgICAgICBvd25lcjogeyBsYWJlbDogJ09wcG9ydHVuaXR5IE93bmVyJyB9LFxuICAgICAgICBhbW91bnQ6IHsgbGFiZWw6ICdBbW91bnQnIH0sXG4gICAgICAgIGV4cGVjdGVkX3JldmVudWU6IHsgbGFiZWw6ICdFeHBlY3RlZCBSZXZlbnVlJyB9LFxuICAgICAgICBzdGFnZToge1xuICAgICAgICAgIGxhYmVsOiAnU3RhZ2UnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHByb3NwZWN0aW5nOiAnUHJvc3BlY3RpbmcnLCBxdWFsaWZpY2F0aW9uOiAnUXVhbGlmaWNhdGlvbicsXG4gICAgICAgICAgICBuZWVkc19hbmFseXNpczogJ05lZWRzIEFuYWx5c2lzJywgcHJvcG9zYWw6ICdQcm9wb3NhbCcsXG4gICAgICAgICAgICBuZWdvdGlhdGlvbjogJ05lZ290aWF0aW9uJywgY2xvc2VkX3dvbjogJ0Nsb3NlZCBXb24nLCBjbG9zZWRfbG9zdDogJ0Nsb3NlZCBMb3N0JyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBwcm9iYWJpbGl0eTogeyBsYWJlbDogJ1Byb2JhYmlsaXR5ICglKScgfSxcbiAgICAgICAgY2xvc2VfZGF0ZTogeyBsYWJlbDogJ0Nsb3NlIERhdGUnIH0sXG4gICAgICAgIHR5cGU6IHtcbiAgICAgICAgICBsYWJlbDogJ1R5cGUnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICdOZXcgQnVzaW5lc3MnOiAnTmV3IEJ1c2luZXNzJyxcbiAgICAgICAgICAgICdFeGlzdGluZyBDdXN0b21lciAtIFVwZ3JhZGUnOiAnRXhpc3RpbmcgQ3VzdG9tZXIgLSBVcGdyYWRlJyxcbiAgICAgICAgICAgICdFeGlzdGluZyBDdXN0b21lciAtIFJlbmV3YWwnOiAnRXhpc3RpbmcgQ3VzdG9tZXIgLSBSZW5ld2FsJyxcbiAgICAgICAgICAgICdFeGlzdGluZyBDdXN0b21lciAtIEV4cGFuc2lvbic6ICdFeGlzdGluZyBDdXN0b21lciAtIEV4cGFuc2lvbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgZm9yZWNhc3RfY2F0ZWdvcnk6IHtcbiAgICAgICAgICBsYWJlbDogJ0ZvcmVjYXN0IENhdGVnb3J5JyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBQaXBlbGluZTogJ1BpcGVsaW5lJywgJ0Jlc3QgQ2FzZSc6ICdCZXN0IENhc2UnLFxuICAgICAgICAgICAgQ29tbWl0OiAnQ29tbWl0JywgT21pdHRlZDogJ09taXR0ZWQnLCBDbG9zZWQ6ICdDbG9zZWQnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGRlc2NyaXB0aW9uOiB7IGxhYmVsOiAnRGVzY3JpcHRpb24nIH0sXG4gICAgICAgIG5leHRfc3RlcDogeyBsYWJlbDogJ05leHQgU3RlcCcgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcblxuICBhcHBzOiB7XG4gICAgY3JtX2VudGVycHJpc2U6IHtcbiAgICAgIGxhYmVsOiAnRW50ZXJwcmlzZSBDUk0nLFxuICAgICAgZGVzY3JpcHRpb246ICdDdXN0b21lciByZWxhdGlvbnNoaXAgbWFuYWdlbWVudCBmb3Igc2FsZXMsIHNlcnZpY2UsIGFuZCBtYXJrZXRpbmcnLFxuICAgIH0sXG4gIH0sXG5cbiAgbWVzc2FnZXM6IHtcbiAgICAnY29tbW9uLnNhdmUnOiAnU2F2ZScsXG4gICAgJ2NvbW1vbi5jYW5jZWwnOiAnQ2FuY2VsJyxcbiAgICAnY29tbW9uLmRlbGV0ZSc6ICdEZWxldGUnLFxuICAgICdjb21tb24uZWRpdCc6ICdFZGl0JyxcbiAgICAnY29tbW9uLmNyZWF0ZSc6ICdDcmVhdGUnLFxuICAgICdjb21tb24uc2VhcmNoJzogJ1NlYXJjaCcsXG4gICAgJ2NvbW1vbi5maWx0ZXInOiAnRmlsdGVyJyxcbiAgICAnY29tbW9uLmV4cG9ydCc6ICdFeHBvcnQnLFxuICAgICdjb21tb24uYmFjayc6ICdCYWNrJyxcbiAgICAnY29tbW9uLmNvbmZpcm0nOiAnQ29uZmlybScsXG4gICAgJ25hdi5zYWxlcyc6ICdTYWxlcycsXG4gICAgJ25hdi5zZXJ2aWNlJzogJ1NlcnZpY2UnLFxuICAgICduYXYubWFya2V0aW5nJzogJ01hcmtldGluZycsXG4gICAgJ25hdi5wcm9kdWN0cyc6ICdQcm9kdWN0cycsXG4gICAgJ25hdi5hbmFseXRpY3MnOiAnQW5hbHl0aWNzJyxcbiAgICAnc3VjY2Vzcy5zYXZlZCc6ICdSZWNvcmQgc2F2ZWQgc3VjY2Vzc2Z1bGx5JyxcbiAgICAnc3VjY2Vzcy5jb252ZXJ0ZWQnOiAnTGVhZCBjb252ZXJ0ZWQgc3VjY2Vzc2Z1bGx5JyxcbiAgICAnY29uZmlybS5kZWxldGUnOiAnQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIGRlbGV0ZSB0aGlzIHJlY29yZD8nLFxuICAgICdjb25maXJtLmNvbnZlcnRfbGVhZCc6ICdDb252ZXJ0IHRoaXMgbGVhZCB0byBhY2NvdW50LCBjb250YWN0LCBhbmQgb3Bwb3J0dW5pdHk/JyxcbiAgICAnZXJyb3IucmVxdWlyZWQnOiAnVGhpcyBmaWVsZCBpcyByZXF1aXJlZCcsXG4gICAgJ2Vycm9yLmxvYWRfZmFpbGVkJzogJ0ZhaWxlZCB0byBsb2FkIGRhdGEnLFxuICB9LFxuXG4gIHZhbGlkYXRpb25NZXNzYWdlczoge1xuICAgIGFtb3VudF9yZXF1aXJlZF9mb3JfY2xvc2VkOiAnQW1vdW50IGlzIHJlcXVpcmVkIHdoZW4gc3RhZ2UgaXMgQ2xvc2VkIFdvbicsXG4gICAgY2xvc2VfZGF0ZV9yZXF1aXJlZDogJ0Nsb3NlIGRhdGUgaXMgcmVxdWlyZWQgZm9yIG9wcG9ydHVuaXRpZXMnLFxuICAgIGRpc2NvdW50X2xpbWl0OiAnRGlzY291bnQgY2Fubm90IGV4Y2VlZCA0MCUnLFxuICB9LFxufTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3RyYW5zbGF0aW9ucy96aC1DTi50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy90cmFuc2xhdGlvbnNcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvdHJhbnNsYXRpb25zL3poLUNOLnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5pbXBvcnQgdHlwZSB7IFRyYW5zbGF0aW9uRGF0YSB9IGZyb20gJ0BvYmplY3RzdGFjay9zcGVjL3N5c3RlbSc7XG5cbi8qKlxuICogXHU3QjgwXHU0RjUzXHU0RTJEXHU2NTg3ICh6aC1DTikgXHUyMDE0IENSTSBBcHAgVHJhbnNsYXRpb25zXG4gKlxuICogUGVyLWxvY2FsZSBmaWxlOiBvbmUgZmlsZSBwZXIgbGFuZ3VhZ2UsIGZvbGxvd2luZyB0aGUgYHBlcl9sb2NhbGVgIGNvbnZlbnRpb24uXG4gKi9cbmV4cG9ydCBjb25zdCB6aENOOiBUcmFuc2xhdGlvbkRhdGEgPSB7XG4gIG9iamVjdHM6IHtcbiAgICBhY2NvdW50OiB7XG4gICAgICBsYWJlbDogJ1x1NUJBMlx1NjIzNycsXG4gICAgICBwbHVyYWxMYWJlbDogJ1x1NUJBMlx1NjIzNycsXG4gICAgICBmaWVsZHM6IHtcbiAgICAgICAgYWNjb3VudF9udW1iZXI6IHsgbGFiZWw6ICdcdTVCQTJcdTYyMzdcdTdGMTZcdTUzRjcnIH0sXG4gICAgICAgIG5hbWU6IHsgbGFiZWw6ICdcdTVCQTJcdTYyMzdcdTU0MERcdTc5RjAnLCBoZWxwOiAnXHU1MTZDXHU1M0Y4XHU2MjE2XHU3RUM0XHU3RUM3XHU3Njg0XHU2Q0Q1XHU1QjlBXHU1NDBEXHU3OUYwJyB9LFxuICAgICAgICB0eXBlOiB7XG4gICAgICAgICAgbGFiZWw6ICdcdTdDN0JcdTU3OEInLFxuICAgICAgICAgIG9wdGlvbnM6IHsgcHJvc3BlY3Q6ICdcdTZGNUNcdTU3MjhcdTVCQTJcdTYyMzcnLCBjdXN0b21lcjogJ1x1NkI2M1x1NUYwRlx1NUJBMlx1NjIzNycsIHBhcnRuZXI6ICdcdTU0MDhcdTRGNUNcdTRGMTlcdTRGMzQnLCBmb3JtZXI6ICdcdTUyNERcdTVCQTJcdTYyMzcnIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGluZHVzdHJ5OiB7XG4gICAgICAgICAgbGFiZWw6ICdcdTg4NENcdTRFMUEnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHRlY2hub2xvZ3k6ICdcdTc5RDFcdTYyODAnLCBmaW5hbmNlOiAnXHU5MUQxXHU4NzhEJywgaGVhbHRoY2FyZTogJ1x1NTMzQlx1NzU5NycsXG4gICAgICAgICAgICByZXRhaWw6ICdcdTk2RjZcdTU1MkUnLCBtYW51ZmFjdHVyaW5nOiAnXHU1MjM2XHU5MDIwJywgZWR1Y2F0aW9uOiAnXHU2NTU5XHU4MEIyJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBhbm51YWxfcmV2ZW51ZTogeyBsYWJlbDogJ1x1NUU3NFx1ODQyNVx1NjUzNicgfSxcbiAgICAgICAgbnVtYmVyX29mX2VtcGxveWVlczogeyBsYWJlbDogJ1x1NTQ1OFx1NURFNVx1NEVCQVx1NjU3MCcgfSxcbiAgICAgICAgcGhvbmU6IHsgbGFiZWw6ICdcdTc1MzVcdThCREQnIH0sXG4gICAgICAgIHdlYnNpdGU6IHsgbGFiZWw6ICdcdTdGNTFcdTdBRDknIH0sXG4gICAgICAgIGJpbGxpbmdfYWRkcmVzczogeyBsYWJlbDogJ1x1OEQyNlx1NTM1NVx1NTczMFx1NTc0MCcgfSxcbiAgICAgICAgb2ZmaWNlX2xvY2F0aW9uOiB7IGxhYmVsOiAnXHU1MjlFXHU1MTZDXHU1NzMwXHU3MEI5JyB9LFxuICAgICAgICBvd25lcjogeyBsYWJlbDogJ1x1NUJBMlx1NjIzN1x1OEQxRlx1OEQyM1x1NEVCQScgfSxcbiAgICAgICAgcGFyZW50X2FjY291bnQ6IHsgbGFiZWw6ICdcdTZCQ0RcdTUxNkNcdTUzRjgnIH0sXG4gICAgICAgIGRlc2NyaXB0aW9uOiB7IGxhYmVsOiAnXHU2M0NGXHU4RkYwJyB9LFxuICAgICAgICBpc19hY3RpdmU6IHsgbGFiZWw6ICdcdTY2MkZcdTU0MjZcdTZEM0JcdThEQzMnIH0sXG4gICAgICAgIGxhc3RfYWN0aXZpdHlfZGF0ZTogeyBsYWJlbDogJ1x1NjcwMFx1OEZEMVx1NkQzQlx1NTJBOFx1NjVFNVx1NjcxRicgfSxcbiAgICAgIH0sXG4gICAgfSxcblxuICAgIGNvbnRhY3Q6IHtcbiAgICAgIGxhYmVsOiAnXHU4MDU0XHU3Q0ZCXHU0RUJBJyxcbiAgICAgIHBsdXJhbExhYmVsOiAnXHU4MDU0XHU3Q0ZCXHU0RUJBJyxcbiAgICAgIGZpZWxkczoge1xuICAgICAgICBzYWx1dGF0aW9uOiB7IGxhYmVsOiAnXHU3OUYwXHU4QzEzJyB9LFxuICAgICAgICBmaXJzdF9uYW1lOiB7IGxhYmVsOiAnXHU1NDBEJyB9LFxuICAgICAgICBsYXN0X25hbWU6IHsgbGFiZWw6ICdcdTU5RDMnIH0sXG4gICAgICAgIGZ1bGxfbmFtZTogeyBsYWJlbDogJ1x1NTE2OFx1NTQwRCcgfSxcbiAgICAgICAgYWNjb3VudDogeyBsYWJlbDogJ1x1NjI0MFx1NUM1RVx1NUJBMlx1NjIzNycgfSxcbiAgICAgICAgZW1haWw6IHsgbGFiZWw6ICdcdTkwQUVcdTdCQjEnIH0sXG4gICAgICAgIHBob25lOiB7IGxhYmVsOiAnXHU3NTM1XHU4QkREJyB9LFxuICAgICAgICBtb2JpbGU6IHsgbGFiZWw6ICdcdTYyNEJcdTY3M0EnIH0sXG4gICAgICAgIHRpdGxlOiB7IGxhYmVsOiAnXHU4MDRDXHU0RjREJyB9LFxuICAgICAgICBkZXBhcnRtZW50OiB7XG4gICAgICAgICAgbGFiZWw6ICdcdTkwRThcdTk1RTgnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIEV4ZWN1dGl2ZTogJ1x1N0JBMVx1NzQwNlx1NUM0MicsIFNhbGVzOiAnXHU5NTAwXHU1NTJFXHU5MEU4JywgTWFya2V0aW5nOiAnXHU1RTAyXHU1NzNBXHU5MEU4JyxcbiAgICAgICAgICAgIEVuZ2luZWVyaW5nOiAnXHU1REU1XHU3QTBCXHU5MEU4JywgU3VwcG9ydDogJ1x1NjUyRlx1NjMwMVx1OTBFOCcsIEZpbmFuY2U6ICdcdThEMjJcdTUyQTFcdTkwRTgnLFxuICAgICAgICAgICAgSFI6ICdcdTRFQkFcdTUyOUJcdThENDRcdTZFOTAnLCBPcGVyYXRpb25zOiAnXHU4RkQwXHU4NDI1XHU5MEU4JyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBvd25lcjogeyBsYWJlbDogJ1x1ODA1NFx1N0NGQlx1NEVCQVx1OEQxRlx1OEQyM1x1NEVCQScgfSxcbiAgICAgICAgZGVzY3JpcHRpb246IHsgbGFiZWw6ICdcdTYzQ0ZcdThGRjAnIH0sXG4gICAgICAgIGlzX3ByaW1hcnk6IHsgbGFiZWw6ICdcdTRFM0JcdTg5ODFcdTgwNTRcdTdDRkJcdTRFQkEnIH0sXG4gICAgICB9LFxuICAgIH0sXG5cbiAgICBsZWFkOiB7XG4gICAgICBsYWJlbDogJ1x1N0VCRlx1N0QyMicsXG4gICAgICBwbHVyYWxMYWJlbDogJ1x1N0VCRlx1N0QyMicsXG4gICAgICBmaWVsZHM6IHtcbiAgICAgICAgZmlyc3RfbmFtZTogeyBsYWJlbDogJ1x1NTQwRCcgfSxcbiAgICAgICAgbGFzdF9uYW1lOiB7IGxhYmVsOiAnXHU1OUQzJyB9LFxuICAgICAgICBjb21wYW55OiB7IGxhYmVsOiAnXHU1MTZDXHU1M0Y4JyB9LFxuICAgICAgICB0aXRsZTogeyBsYWJlbDogJ1x1ODA0Q1x1NEY0RCcgfSxcbiAgICAgICAgZW1haWw6IHsgbGFiZWw6ICdcdTkwQUVcdTdCQjEnIH0sXG4gICAgICAgIHBob25lOiB7IGxhYmVsOiAnXHU3NTM1XHU4QkREJyB9LFxuICAgICAgICBzdGF0dXM6IHtcbiAgICAgICAgICBsYWJlbDogJ1x1NzJCNlx1NjAwMScsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgbmV3OiAnXHU2NUIwXHU1RUZBJywgY29udGFjdGVkOiAnXHU1REYyXHU4MDU0XHU3Q0ZCJywgcXVhbGlmaWVkOiAnXHU1REYyXHU3ODZFXHU4QkE0JyxcbiAgICAgICAgICAgIHVucXVhbGlmaWVkOiAnXHU0RTBEXHU1NDA4XHU2ODNDJywgY29udmVydGVkOiAnXHU1REYyXHU4RjZDXHU1MzE2JyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBsZWFkX3NvdXJjZToge1xuICAgICAgICAgIGxhYmVsOiAnXHU3RUJGXHU3RDIyXHU2NzY1XHU2RTkwJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBXZWI6ICdcdTdGNTFcdTdBRDknLCBSZWZlcnJhbDogJ1x1NjNBOFx1ODM1MCcsIEV2ZW50OiAnXHU2RDNCXHU1MkE4JyxcbiAgICAgICAgICAgIFBhcnRuZXI6ICdcdTU0MDhcdTRGNUNcdTRGMTlcdTRGMzQnLCBBZHZlcnRpc2VtZW50OiAnXHU1RTdGXHU1NDRBJywgJ0NvbGQgQ2FsbCc6ICdcdTk2NENcdTc1MUZcdTYyRENcdThCQkYnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIG93bmVyOiB7IGxhYmVsOiAnXHU3RUJGXHU3RDIyXHU4RDFGXHU4RDIzXHU0RUJBJyB9LFxuICAgICAgICBpc19jb252ZXJ0ZWQ6IHsgbGFiZWw6ICdcdTVERjJcdThGNkNcdTUzMTYnIH0sXG4gICAgICAgIGRlc2NyaXB0aW9uOiB7IGxhYmVsOiAnXHU2M0NGXHU4RkYwJyB9LFxuICAgICAgfSxcbiAgICB9LFxuXG4gICAgb3Bwb3J0dW5pdHk6IHtcbiAgICAgIGxhYmVsOiAnXHU1NTQ2XHU2NzNBJyxcbiAgICAgIHBsdXJhbExhYmVsOiAnXHU1NTQ2XHU2NzNBJyxcbiAgICAgIGZpZWxkczoge1xuICAgICAgICBuYW1lOiB7IGxhYmVsOiAnXHU1NTQ2XHU2NzNBXHU1NDBEXHU3OUYwJyB9LFxuICAgICAgICBhY2NvdW50OiB7IGxhYmVsOiAnXHU2MjQwXHU1QzVFXHU1QkEyXHU2MjM3JyB9LFxuICAgICAgICBwcmltYXJ5X2NvbnRhY3Q6IHsgbGFiZWw6ICdcdTRFM0JcdTg5ODFcdTgwNTRcdTdDRkJcdTRFQkEnIH0sXG4gICAgICAgIG93bmVyOiB7IGxhYmVsOiAnXHU1NTQ2XHU2NzNBXHU4RDFGXHU4RDIzXHU0RUJBJyB9LFxuICAgICAgICBhbW91bnQ6IHsgbGFiZWw6ICdcdTkxRDFcdTk4OUQnIH0sXG4gICAgICAgIGV4cGVjdGVkX3JldmVudWU6IHsgbGFiZWw6ICdcdTk4ODRcdTY3MUZcdTY1MzZcdTUxNjUnIH0sXG4gICAgICAgIHN0YWdlOiB7XG4gICAgICAgICAgbGFiZWw6ICdcdTk2MzZcdTZCQjUnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHByb3NwZWN0aW5nOiAnXHU1QkZCXHU2MjdFXHU1QkEyXHU2MjM3JywgcXVhbGlmaWNhdGlvbjogJ1x1OEQ0NFx1NjgzQ1x1NUJBMVx1NjdFNScsXG4gICAgICAgICAgICBuZWVkc19hbmFseXNpczogJ1x1OTcwMFx1NkM0Mlx1NTIwNlx1Njc5MCcsIHByb3Bvc2FsOiAnXHU2M0QwXHU2ODQ4JyxcbiAgICAgICAgICAgIG5lZ290aWF0aW9uOiAnXHU4QzA4XHU1MjI0JywgY2xvc2VkX3dvbjogJ1x1NjIxMFx1NEVBNCcsIGNsb3NlZF9sb3N0OiAnXHU1OTMxXHU4RDI1JyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBwcm9iYWJpbGl0eTogeyBsYWJlbDogJ1x1NjIxMFx1NEVBNFx1Njk4Mlx1NzM4NyAoJSknIH0sXG4gICAgICAgIGNsb3NlX2RhdGU6IHsgbGFiZWw6ICdcdTk4ODRcdThCQTFcdTYyMTBcdTRFQTRcdTY1RTVcdTY3MUYnIH0sXG4gICAgICAgIHR5cGU6IHtcbiAgICAgICAgICBsYWJlbDogJ1x1N0M3Qlx1NTc4QicsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgJ05ldyBCdXNpbmVzcyc6ICdcdTY1QjBcdTRFMUFcdTUyQTEnLFxuICAgICAgICAgICAgJ0V4aXN0aW5nIEN1c3RvbWVyIC0gVXBncmFkZSc6ICdcdTgwMDFcdTVCQTJcdTYyMzdcdTUzNDdcdTdFQTcnLFxuICAgICAgICAgICAgJ0V4aXN0aW5nIEN1c3RvbWVyIC0gUmVuZXdhbCc6ICdcdTgwMDFcdTVCQTJcdTYyMzdcdTdFRURcdTdFQTYnLFxuICAgICAgICAgICAgJ0V4aXN0aW5nIEN1c3RvbWVyIC0gRXhwYW5zaW9uJzogJ1x1ODAwMVx1NUJBMlx1NjIzN1x1NjJEM1x1NUM1NScsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgZm9yZWNhc3RfY2F0ZWdvcnk6IHtcbiAgICAgICAgICBsYWJlbDogJ1x1OTg4NFx1NkQ0Qlx1N0M3Qlx1NTIyQicsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgUGlwZWxpbmU6ICdcdTdCQTFcdTkwNTMnLCAnQmVzdCBDYXNlJzogJ1x1NjcwMFx1NEY3M1x1NjBDNVx1NTFCNScsXG4gICAgICAgICAgICBDb21taXQ6ICdcdTYyN0ZcdThCRkEnLCBPbWl0dGVkOiAnXHU1REYyXHU2MzkyXHU5NjY0JywgQ2xvc2VkOiAnXHU1REYyXHU1MTczXHU5NUVEJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBkZXNjcmlwdGlvbjogeyBsYWJlbDogJ1x1NjNDRlx1OEZGMCcgfSxcbiAgICAgICAgbmV4dF9zdGVwOiB7IGxhYmVsOiAnXHU0RTBCXHU0RTAwXHU2QjY1JyB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuXG4gIGFwcHM6IHtcbiAgICBjcm1fZW50ZXJwcmlzZToge1xuICAgICAgbGFiZWw6ICdcdTRGMDFcdTRFMUEgQ1JNJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU2REI1XHU3NkQ2XHU5NTAwXHU1NTJFXHUzMDAxXHU2NzBEXHU1MkExXHU1NDhDXHU1RTAyXHU1NzNBXHU4NDI1XHU5NTAwXHU3Njg0XHU1QkEyXHU2MjM3XHU1MTczXHU3Q0ZCXHU3QkExXHU3NDA2XHU3Q0ZCXHU3RURGJyxcbiAgICB9LFxuICB9LFxuXG4gIG1lc3NhZ2VzOiB7XG4gICAgJ2NvbW1vbi5zYXZlJzogJ1x1NEZERFx1NUI1OCcsXG4gICAgJ2NvbW1vbi5jYW5jZWwnOiAnXHU1M0Q2XHU2RDg4JyxcbiAgICAnY29tbW9uLmRlbGV0ZSc6ICdcdTUyMjBcdTk2NjQnLFxuICAgICdjb21tb24uZWRpdCc6ICdcdTdGMTZcdThGOTEnLFxuICAgICdjb21tb24uY3JlYXRlJzogJ1x1NjVCMFx1NUVGQScsXG4gICAgJ2NvbW1vbi5zZWFyY2gnOiAnXHU2NDFDXHU3RDIyJyxcbiAgICAnY29tbW9uLmZpbHRlcic6ICdcdTdCNUJcdTkwMDknLFxuICAgICdjb21tb24uZXhwb3J0JzogJ1x1NUJGQ1x1NTFGQScsXG4gICAgJ2NvbW1vbi5iYWNrJzogJ1x1OEZENFx1NTZERScsXG4gICAgJ2NvbW1vbi5jb25maXJtJzogJ1x1Nzg2RVx1OEJBNCcsXG4gICAgJ25hdi5zYWxlcyc6ICdcdTk1MDBcdTU1MkUnLFxuICAgICduYXYuc2VydmljZSc6ICdcdTY3MERcdTUyQTEnLFxuICAgICduYXYubWFya2V0aW5nJzogJ1x1ODQyNVx1OTUwMCcsXG4gICAgJ25hdi5wcm9kdWN0cyc6ICdcdTRFQTdcdTU0QzEnLFxuICAgICduYXYuYW5hbHl0aWNzJzogJ1x1NjU3MFx1NjM2RVx1NTIwNlx1Njc5MCcsXG4gICAgJ3N1Y2Nlc3Muc2F2ZWQnOiAnXHU4QkIwXHU1RjU1XHU0RkREXHU1QjU4XHU2MjEwXHU1MjlGJyxcbiAgICAnc3VjY2Vzcy5jb252ZXJ0ZWQnOiAnXHU3RUJGXHU3RDIyXHU4RjZDXHU1MzE2XHU2MjEwXHU1MjlGJyxcbiAgICAnY29uZmlybS5kZWxldGUnOiAnXHU3ODZFXHU1QjlBXHU4OTgxXHU1MjIwXHU5NjY0XHU2QjY0XHU4QkIwXHU1RjU1XHU1NDE3XHVGRjFGJyxcbiAgICAnY29uZmlybS5jb252ZXJ0X2xlYWQnOiAnXHU1QzA2XHU2QjY0XHU3RUJGXHU3RDIyXHU4RjZDXHU1MzE2XHU0RTNBXHU1QkEyXHU2MjM3XHUzMDAxXHU4MDU0XHU3Q0ZCXHU0RUJBXHU1NDhDXHU1NTQ2XHU2NzNBXHVGRjFGJyxcbiAgICAnZXJyb3IucmVxdWlyZWQnOiAnXHU2QjY0XHU1QjU3XHU2QkI1XHU0RTNBXHU1RkM1XHU1ODZCXHU5ODc5JyxcbiAgICAnZXJyb3IubG9hZF9mYWlsZWQnOiAnXHU2NTcwXHU2MzZFXHU1MkEwXHU4RjdEXHU1OTMxXHU4RDI1JyxcbiAgfSxcblxuICB2YWxpZGF0aW9uTWVzc2FnZXM6IHtcbiAgICBhbW91bnRfcmVxdWlyZWRfZm9yX2Nsb3NlZDogJ1x1OTYzNlx1NkJCNVx1NEUzQVwiXHU2MjEwXHU0RUE0XCJcdTY1RjZcdUZGMENcdTkxRDFcdTk4OURcdTRFM0FcdTVGQzVcdTU4NkJcdTk4NzknLFxuICAgIGNsb3NlX2RhdGVfcmVxdWlyZWQ6ICdcdTU1NDZcdTY3M0FcdTVGQzVcdTk4N0JcdTU4NkJcdTUxOTlcdTk4ODRcdThCQTFcdTYyMTBcdTRFQTRcdTY1RTVcdTY3MUYnLFxuICAgIGRpc2NvdW50X2xpbWl0OiAnXHU2Mjk4XHU2MjYzXHU0RTBEXHU4MEZEXHU4RDg1XHU4RkM3NDAlJyxcbiAgfSxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy90cmFuc2xhdGlvbnMvamEtSlAudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvdHJhbnNsYXRpb25zXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3RyYW5zbGF0aW9ucy9qYS1KUC50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuaW1wb3J0IHR5cGUgeyBUcmFuc2xhdGlvbkRhdGEgfSBmcm9tICdAb2JqZWN0c3RhY2svc3BlYy9zeXN0ZW0nO1xuXG4vKipcbiAqIFx1NjVFNVx1NjcyQ1x1OEE5RSAoamEtSlApIFx1MjAxNCBDUk0gQXBwIFRyYW5zbGF0aW9uc1xuICpcbiAqIFBlci1sb2NhbGUgZmlsZTogb25lIGZpbGUgcGVyIGxhbmd1YWdlLCBmb2xsb3dpbmcgdGhlIGBwZXJfbG9jYWxlYCBjb252ZW50aW9uLlxuICovXG5leHBvcnQgY29uc3QgamFKUDogVHJhbnNsYXRpb25EYXRhID0ge1xuICBvYmplY3RzOiB7XG4gICAgYWNjb3VudDoge1xuICAgICAgbGFiZWw6ICdcdTUzRDZcdTVGMTVcdTUxNDgnLFxuICAgICAgcGx1cmFsTGFiZWw6ICdcdTUzRDZcdTVGMTVcdTUxNDgnLFxuICAgICAgZmllbGRzOiB7XG4gICAgICAgIGFjY291bnRfbnVtYmVyOiB7IGxhYmVsOiAnXHU1M0Q2XHU1RjE1XHU1MTQ4XHU3NTZBXHU1M0Y3JyB9LFxuICAgICAgICBuYW1lOiB7IGxhYmVsOiAnXHU1M0Q2XHU1RjE1XHU1MTQ4XHU1NDBEJywgaGVscDogJ1x1NEYxQVx1NzkzRVx1MzA3RVx1MzA1Rlx1MzA2Rlx1N0Q0NFx1N0U1NFx1MzA2RVx1NkI2M1x1NUYwRlx1NTQwRFx1NzlGMCcgfSxcbiAgICAgICAgdHlwZToge1xuICAgICAgICAgIGxhYmVsOiAnXHUzMEJGXHUzMEE0XHUzMEQ3JyxcbiAgICAgICAgICBvcHRpb25zOiB7IHByb3NwZWN0OiAnXHU4OThCXHU4RkJDXHUzMDdGXHU1QkEyJywgY3VzdG9tZXI6ICdcdTk4NjdcdTVCQTInLCBwYXJ0bmVyOiAnXHUzMEQxXHUzMEZDXHUzMEM4XHUzMENBXHUzMEZDJywgZm9ybWVyOiAnXHU5MDRFXHU1M0JCXHUzMDZFXHU1M0Q2XHU1RjE1XHU1MTQ4JyB9LFxuICAgICAgICB9LFxuICAgICAgICBpbmR1c3RyeToge1xuICAgICAgICAgIGxhYmVsOiAnXHU2OTZEXHU3QTJFJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICB0ZWNobm9sb2d5OiAnXHUzMEM2XHUzMEFGXHUzMENFXHUzMEVEXHUzMEI4XHUzMEZDJywgZmluYW5jZTogJ1x1OTFEMVx1ODc4RCcsIGhlYWx0aGNhcmU6ICdcdTMwRDhcdTMwRUJcdTMwQjlcdTMwQjFcdTMwQTInLFxuICAgICAgICAgICAgcmV0YWlsOiAnXHU1QzBGXHU1OEYyJywgbWFudWZhY3R1cmluZzogJ1x1ODhGRFx1OTAyMCcsIGVkdWNhdGlvbjogJ1x1NjU1OVx1ODBCMicsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgYW5udWFsX3JldmVudWU6IHsgbGFiZWw6ICdcdTVFNzRcdTk1OTNcdTU4RjJcdTRFMEEnIH0sXG4gICAgICAgIG51bWJlcl9vZl9lbXBsb3llZXM6IHsgbGFiZWw6ICdcdTVGOTNcdTY5NkRcdTU0RTFcdTY1NzAnIH0sXG4gICAgICAgIHBob25lOiB7IGxhYmVsOiAnXHU5NkZCXHU4QTcxXHU3NTZBXHU1M0Y3JyB9LFxuICAgICAgICB3ZWJzaXRlOiB7IGxhYmVsOiAnV2ViXHUzMEI1XHUzMEE0XHUzMEM4JyB9LFxuICAgICAgICBiaWxsaW5nX2FkZHJlc3M6IHsgbGFiZWw6ICdcdThBQ0JcdTZDNDJcdTUxNDhcdTRGNEZcdTYyNDAnIH0sXG4gICAgICAgIG9mZmljZV9sb2NhdGlvbjogeyBsYWJlbDogJ1x1MzBBQVx1MzBENVx1MzBBM1x1MzBCOVx1NjI0MFx1NTcyOFx1NTczMCcgfSxcbiAgICAgICAgb3duZXI6IHsgbGFiZWw6ICdcdTUzRDZcdTVGMTVcdTUxNDhcdThDQUNcdTRFRkJcdTgwMDUnIH0sXG4gICAgICAgIHBhcmVudF9hY2NvdW50OiB7IGxhYmVsOiAnXHU4OUFBXHU1M0Q2XHU1RjE1XHU1MTQ4JyB9LFxuICAgICAgICBkZXNjcmlwdGlvbjogeyBsYWJlbDogJ1x1OEFBQ1x1NjYwRScgfSxcbiAgICAgICAgaXNfYWN0aXZlOiB7IGxhYmVsOiAnXHU2NzA5XHU1MkI5JyB9LFxuICAgICAgICBsYXN0X2FjdGl2aXR5X2RhdGU6IHsgbGFiZWw6ICdcdTY3MDBcdTdENDJcdTZEM0JcdTUyRDVcdTY1RTUnIH0sXG4gICAgICB9LFxuICAgIH0sXG5cbiAgICBjb250YWN0OiB7XG4gICAgICBsYWJlbDogJ1x1NTNENlx1NUYxNVx1NTE0OFx1OENBQ1x1NEVGQlx1ODAwNScsXG4gICAgICBwbHVyYWxMYWJlbDogJ1x1NTNENlx1NUYxNVx1NTE0OFx1OENBQ1x1NEVGQlx1ODAwNScsXG4gICAgICBmaWVsZHM6IHtcbiAgICAgICAgc2FsdXRhdGlvbjogeyBsYWJlbDogJ1x1NjU2Q1x1NzlGMCcgfSxcbiAgICAgICAgZmlyc3RfbmFtZTogeyBsYWJlbDogJ1x1NTQwRCcgfSxcbiAgICAgICAgbGFzdF9uYW1lOiB7IGxhYmVsOiAnXHU1OUQzJyB9LFxuICAgICAgICBmdWxsX25hbWU6IHsgbGFiZWw6ICdcdTZDMEZcdTU0MEQnIH0sXG4gICAgICAgIGFjY291bnQ6IHsgbGFiZWw6ICdcdTUzRDZcdTVGMTVcdTUxNDgnIH0sXG4gICAgICAgIGVtYWlsOiB7IGxhYmVsOiAnXHUzMEUxXHUzMEZDXHUzMEVCJyB9LFxuICAgICAgICBwaG9uZTogeyBsYWJlbDogJ1x1OTZGQlx1OEE3MScgfSxcbiAgICAgICAgbW9iaWxlOiB7IGxhYmVsOiAnXHU2NDNBXHU1RTJGXHU5NkZCXHU4QTcxJyB9LFxuICAgICAgICB0aXRsZTogeyBsYWJlbDogJ1x1NUY3OVx1ODA3NycgfSxcbiAgICAgICAgZGVwYXJ0bWVudDoge1xuICAgICAgICAgIGxhYmVsOiAnXHU5MEU4XHU5NTgwJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBFeGVjdXRpdmU6ICdcdTdENENcdTU1QjZcdTVDNjQnLCBTYWxlczogJ1x1NTVCNlx1Njk2RFx1OTBFOCcsIE1hcmtldGluZzogJ1x1MzBERVx1MzBGQ1x1MzBCMVx1MzBDNlx1MzBBM1x1MzBGM1x1MzBCMFx1OTBFOCcsXG4gICAgICAgICAgICBFbmdpbmVlcmluZzogJ1x1MzBBOFx1MzBGM1x1MzBCOFx1MzBDQlx1MzBBMlx1MzBFQVx1MzBGM1x1MzBCMFx1OTBFOCcsIFN1cHBvcnQ6ICdcdTMwQjVcdTMwRERcdTMwRkNcdTMwQzhcdTkwRTgnLCBGaW5hbmNlOiAnXHU3RDRDXHU3NDA2XHU5MEU4JyxcbiAgICAgICAgICAgIEhSOiAnXHU0RUJBXHU0RThCXHU5MEU4JywgT3BlcmF0aW9uczogJ1x1MzBBQVx1MzBEQVx1MzBFQ1x1MzBGQ1x1MzBCN1x1MzBFN1x1MzBGM1x1OTBFOCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgb3duZXI6IHsgbGFiZWw6ICdcdTYyNDBcdTY3MDlcdTgwMDUnIH0sXG4gICAgICAgIGRlc2NyaXB0aW9uOiB7IGxhYmVsOiAnXHU4QUFDXHU2NjBFJyB9LFxuICAgICAgICBpc19wcmltYXJ5OiB7IGxhYmVsOiAnXHU0RTNCXHU2MkM1XHU1RjUzXHU4MDA1JyB9LFxuICAgICAgfSxcbiAgICB9LFxuXG4gICAgbGVhZDoge1xuICAgICAgbGFiZWw6ICdcdTMwRUFcdTMwRkNcdTMwQzknLFxuICAgICAgcGx1cmFsTGFiZWw6ICdcdTMwRUFcdTMwRkNcdTMwQzknLFxuICAgICAgZmllbGRzOiB7XG4gICAgICAgIGZpcnN0X25hbWU6IHsgbGFiZWw6ICdcdTU0MEQnIH0sXG4gICAgICAgIGxhc3RfbmFtZTogeyBsYWJlbDogJ1x1NTlEMycgfSxcbiAgICAgICAgY29tcGFueTogeyBsYWJlbDogJ1x1NEYxQVx1NzkzRVx1NTQwRCcgfSxcbiAgICAgICAgdGl0bGU6IHsgbGFiZWw6ICdcdTVGNzlcdTgwNzcnIH0sXG4gICAgICAgIGVtYWlsOiB7IGxhYmVsOiAnXHUzMEUxXHUzMEZDXHUzMEVCJyB9LFxuICAgICAgICBwaG9uZTogeyBsYWJlbDogJ1x1OTZGQlx1OEE3MScgfSxcbiAgICAgICAgc3RhdHVzOiB7XG4gICAgICAgICAgbGFiZWw6ICdcdTMwQjlcdTMwQzZcdTMwRkNcdTMwQkZcdTMwQjknLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIG5ldzogJ1x1NjVCMFx1ODk4RicsIGNvbnRhY3RlZDogJ1x1MzBCM1x1MzBGM1x1MzBCRlx1MzBBRlx1MzBDOFx1NkUwOFx1MzA3RicsIHF1YWxpZmllZDogJ1x1OTA2OVx1NjgzQycsXG4gICAgICAgICAgICB1bnF1YWxpZmllZDogJ1x1NEUwRFx1OTA2OVx1NjgzQycsIGNvbnZlcnRlZDogJ1x1NTNENlx1NUYxNVx1OTU4Qlx1NTlDQlx1NkUwOFx1MzA3RicsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgbGVhZF9zb3VyY2U6IHtcbiAgICAgICAgICBsYWJlbDogJ1x1MzBFQVx1MzBGQ1x1MzBDOVx1MzBCRFx1MzBGQ1x1MzBCOScsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgV2ViOiAnV2ViJywgUmVmZXJyYWw6ICdcdTdEMzlcdTRFQ0InLCBFdmVudDogJ1x1MzBBNFx1MzBEOVx1MzBGM1x1MzBDOCcsXG4gICAgICAgICAgICBQYXJ0bmVyOiAnXHUzMEQxXHUzMEZDXHUzMEM4XHUzMENBXHUzMEZDJywgQWR2ZXJ0aXNlbWVudDogJ1x1NUU4M1x1NTQ0QScsICdDb2xkIENhbGwnOiAnXHUzMEIzXHUzMEZDXHUzMEVCXHUzMEM5XHUzMEIzXHUzMEZDXHUzMEVCJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBvd25lcjogeyBsYWJlbDogJ1x1MzBFQVx1MzBGQ1x1MzBDOVx1NjI0MFx1NjcwOVx1ODAwNScgfSxcbiAgICAgICAgaXNfY29udmVydGVkOiB7IGxhYmVsOiAnXHU1M0Q2XHU1RjE1XHU5NThCXHU1OUNCXHU2RTA4XHUzMDdGJyB9LFxuICAgICAgICBkZXNjcmlwdGlvbjogeyBsYWJlbDogJ1x1OEFBQ1x1NjYwRScgfSxcbiAgICAgIH0sXG4gICAgfSxcblxuICAgIG9wcG9ydHVuaXR5OiB7XG4gICAgICBsYWJlbDogJ1x1NTU0Nlx1OEFDNycsXG4gICAgICBwbHVyYWxMYWJlbDogJ1x1NTU0Nlx1OEFDNycsXG4gICAgICBmaWVsZHM6IHtcbiAgICAgICAgbmFtZTogeyBsYWJlbDogJ1x1NTU0Nlx1OEFDN1x1NTQwRCcgfSxcbiAgICAgICAgYWNjb3VudDogeyBsYWJlbDogJ1x1NTNENlx1NUYxNVx1NTE0OCcgfSxcbiAgICAgICAgcHJpbWFyeV9jb250YWN0OiB7IGxhYmVsOiAnXHU0RTNCXHU2MkM1XHU1RjUzXHU4MDA1JyB9LFxuICAgICAgICBvd25lcjogeyBsYWJlbDogJ1x1NTU0Nlx1OEFDN1x1NjI0MFx1NjcwOVx1ODAwNScgfSxcbiAgICAgICAgYW1vdW50OiB7IGxhYmVsOiAnXHU5MUQxXHU5ODREJyB9LFxuICAgICAgICBleHBlY3RlZF9yZXZlbnVlOiB7IGxhYmVsOiAnXHU2NzFGXHU1Rjg1XHU1M0NFXHU3NkNBJyB9LFxuICAgICAgICBzdGFnZToge1xuICAgICAgICAgIGxhYmVsOiAnXHUzMEQ1XHUzMEE3XHUzMEZDXHUzMEJBJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBwcm9zcGVjdGluZzogJ1x1ODk4Qlx1OEZCQ1x1MzA3Rlx1OEFCRlx1NjdGQicsIHF1YWxpZmljYXRpb246ICdcdTkwNzhcdTVCOUEnLFxuICAgICAgICAgICAgbmVlZHNfYW5hbHlzaXM6ICdcdTMwQ0JcdTMwRkNcdTMwQkFcdTUyMDZcdTY3OTAnLCBwcm9wb3NhbDogJ1x1NjNEMFx1Njg0OCcsXG4gICAgICAgICAgICBuZWdvdGlhdGlvbjogJ1x1NEVBNFx1NkUwOScsIGNsb3NlZF93b246ICdcdTYyMTBcdTdBQ0InLCBjbG9zZWRfbG9zdDogJ1x1NEUwRFx1NjIxMFx1N0FDQicsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgcHJvYmFiaWxpdHk6IHsgbGFiZWw6ICdcdTc4QkFcdTVFQTYgKCUpJyB9LFxuICAgICAgICBjbG9zZV9kYXRlOiB7IGxhYmVsOiAnXHU1QjhDXHU0RTg2XHU0RTg4XHU1QjlBXHU2NUU1JyB9LFxuICAgICAgICB0eXBlOiB7XG4gICAgICAgICAgbGFiZWw6ICdcdTMwQkZcdTMwQTRcdTMwRDcnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICdOZXcgQnVzaW5lc3MnOiAnXHU2NUIwXHU4OThGXHUzMEQzXHUzMEI4XHUzMENEXHUzMEI5JyxcbiAgICAgICAgICAgICdFeGlzdGluZyBDdXN0b21lciAtIFVwZ3JhZGUnOiAnXHU2NUUyXHU1QjU4XHU5ODY3XHU1QkEyIC0gXHUzMEEyXHUzMEMzXHUzMEQ3XHUzMEIwXHUzMEVDXHUzMEZDXHUzMEM5JyxcbiAgICAgICAgICAgICdFeGlzdGluZyBDdXN0b21lciAtIFJlbmV3YWwnOiAnXHU2NUUyXHU1QjU4XHU5ODY3XHU1QkEyIC0gXHU2NkY0XHU2NUIwJyxcbiAgICAgICAgICAgICdFeGlzdGluZyBDdXN0b21lciAtIEV4cGFuc2lvbic6ICdcdTY1RTJcdTVCNThcdTk4NjdcdTVCQTIgLSBcdTYyRTFcdTU5MjcnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGZvcmVjYXN0X2NhdGVnb3J5OiB7XG4gICAgICAgICAgbGFiZWw6ICdcdTU4RjJcdTRFMEFcdTRFODhcdTZFMkNcdTMwQUJcdTMwQzZcdTMwQjRcdTMwRUEnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIFBpcGVsaW5lOiAnXHUzMEQxXHUzMEE0XHUzMEQ3XHUzMEU5XHUzMEE0XHUzMEYzJywgJ0Jlc3QgQ2FzZSc6ICdcdTY3MDBcdTgyNkZcdTMwQjFcdTMwRkNcdTMwQjknLFxuICAgICAgICAgICAgQ29tbWl0OiAnXHUzMEIzXHUzMERGXHUzMEMzXHUzMEM4JywgT21pdHRlZDogJ1x1OTY2NFx1NTkxNicsIENsb3NlZDogJ1x1NUI4Q1x1NEU4NicsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgZGVzY3JpcHRpb246IHsgbGFiZWw6ICdcdThBQUNcdTY2MEUnIH0sXG4gICAgICAgIG5leHRfc3RlcDogeyBsYWJlbDogJ1x1NkIyMVx1MzA2RVx1MzBCOVx1MzBDNlx1MzBDM1x1MzBENycgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcblxuICBhcHBzOiB7XG4gICAgY3JtX2VudGVycHJpc2U6IHtcbiAgICAgIGxhYmVsOiAnXHUzMEE4XHUzMEYzXHUzMEJGXHUzMEZDXHUzMEQ3XHUzMEU5XHUzMEE0XHUzMEJBIENSTScsXG4gICAgICBkZXNjcmlwdGlvbjogJ1x1NTVCNlx1Njk2RFx1MzBGQlx1MzBCNVx1MzBGQ1x1MzBEM1x1MzBCOVx1MzBGQlx1MzBERVx1MzBGQ1x1MzBCMVx1MzBDNlx1MzBBM1x1MzBGM1x1MzBCMFx1NTQxMVx1MzA1MVx1OTg2N1x1NUJBMlx1OTVBMlx1NEZDMlx1N0JBMVx1NzQwNlx1MzBCN1x1MzBCOVx1MzBDNlx1MzBFMCcsXG4gICAgfSxcbiAgfSxcblxuICBtZXNzYWdlczoge1xuICAgICdjb21tb24uc2F2ZSc6ICdcdTRGRERcdTVCNTgnLFxuICAgICdjb21tb24uY2FuY2VsJzogJ1x1MzBBRFx1MzBFM1x1MzBGM1x1MzBCQlx1MzBFQicsXG4gICAgJ2NvbW1vbi5kZWxldGUnOiAnXHU1MjRBXHU5NjY0JyxcbiAgICAnY29tbW9uLmVkaXQnOiAnXHU3REU4XHU5NkM2JyxcbiAgICAnY29tbW9uLmNyZWF0ZSc6ICdcdTY1QjBcdTg5OEZcdTRGNUNcdTYyMTAnLFxuICAgICdjb21tb24uc2VhcmNoJzogJ1x1NjkxQ1x1N0QyMicsXG4gICAgJ2NvbW1vbi5maWx0ZXInOiAnXHUzMEQ1XHUzMEEzXHUzMEVCXHUzMEJGXHUzMEZDJyxcbiAgICAnY29tbW9uLmV4cG9ydCc6ICdcdTMwQThcdTMwQUZcdTMwQjlcdTMwRERcdTMwRkNcdTMwQzgnLFxuICAgICdjb21tb24uYmFjayc6ICdcdTYyM0JcdTMwOEInLFxuICAgICdjb21tb24uY29uZmlybSc6ICdcdTc4QkFcdThBOEQnLFxuICAgICduYXYuc2FsZXMnOiAnXHU1NUI2XHU2OTZEJyxcbiAgICAnbmF2LnNlcnZpY2UnOiAnXHUzMEI1XHUzMEZDXHUzMEQzXHUzMEI5JyxcbiAgICAnbmF2Lm1hcmtldGluZyc6ICdcdTMwREVcdTMwRkNcdTMwQjFcdTMwQzZcdTMwQTNcdTMwRjNcdTMwQjAnLFxuICAgICduYXYucHJvZHVjdHMnOiAnXHU4OEZEXHU1NEMxJyxcbiAgICAnbmF2LmFuYWx5dGljcyc6ICdcdTMwQTJcdTMwQ0FcdTMwRUFcdTMwQzZcdTMwQTNcdTMwQUZcdTMwQjknLFxuICAgICdzdWNjZXNzLnNhdmVkJzogJ1x1MzBFQ1x1MzBCM1x1MzBGQ1x1MzBDOVx1MzA5Mlx1NEZERFx1NUI1OFx1MzA1N1x1MzA3RVx1MzA1N1x1MzA1RicsXG4gICAgJ3N1Y2Nlc3MuY29udmVydGVkJzogJ1x1MzBFQVx1MzBGQ1x1MzBDOVx1MzA5Mlx1NTNENlx1NUYxNVx1OTU4Qlx1NTlDQlx1MzA1N1x1MzA3RVx1MzA1N1x1MzA1RicsXG4gICAgJ2NvbmZpcm0uZGVsZXRlJzogJ1x1MzA1M1x1MzA2RVx1MzBFQ1x1MzBCM1x1MzBGQ1x1MzBDOVx1MzA5Mlx1NTI0QVx1OTY2NFx1MzA1N1x1MzA2Nlx1MzA4Mlx1MzA4OFx1MzA4RFx1MzA1N1x1MzA0NFx1MzA2N1x1MzA1OVx1MzA0Qlx1RkYxRicsXG4gICAgJ2NvbmZpcm0uY29udmVydF9sZWFkJzogJ1x1MzA1M1x1MzA2RVx1MzBFQVx1MzBGQ1x1MzBDOVx1MzA5Mlx1NTNENlx1NUYxNVx1NTE0OFx1MzBGQlx1NTNENlx1NUYxNVx1NTE0OFx1OENBQ1x1NEVGQlx1ODAwNVx1MzBGQlx1NTU0Nlx1OEFDN1x1MzA2Qlx1NTkwOVx1NjNEQlx1MzA1N1x1MzA3RVx1MzA1OVx1MzA0Qlx1RkYxRicsXG4gICAgJ2Vycm9yLnJlcXVpcmVkJzogJ1x1MzA1M1x1MzA2RVx1OTgwNVx1NzZFRVx1MzA2Rlx1NUZDNVx1OTgwOFx1MzA2N1x1MzA1OScsXG4gICAgJ2Vycm9yLmxvYWRfZmFpbGVkJzogJ1x1MzBDN1x1MzBGQ1x1MzBCRlx1MzA2RVx1OEFBRFx1MzA3Rlx1OEZCQ1x1MzA3Rlx1MzA2Qlx1NTkzMVx1NjU1N1x1MzA1N1x1MzA3RVx1MzA1N1x1MzA1RicsXG4gIH0sXG5cbiAgdmFsaWRhdGlvbk1lc3NhZ2VzOiB7XG4gICAgYW1vdW50X3JlcXVpcmVkX2Zvcl9jbG9zZWQ6ICdcdTMwRDVcdTMwQTdcdTMwRkNcdTMwQkFcdTMwNENcdTMwMENcdTYyMTBcdTdBQ0JcdTMwMERcdTMwNkVcdTU4MzRcdTU0MDhcdTMwMDFcdTkxRDFcdTk4NERcdTMwNkZcdTVGQzVcdTk4MDhcdTMwNjdcdTMwNTknLFxuICAgIGNsb3NlX2RhdGVfcmVxdWlyZWQ6ICdcdTU1NDZcdThBQzdcdTMwNkJcdTMwNkZcdTVCOENcdTRFODZcdTRFODhcdTVCOUFcdTY1RTVcdTMwNENcdTVGQzVcdTg5ODFcdTMwNjdcdTMwNTknLFxuICAgIGRpc2NvdW50X2xpbWl0OiAnXHU1MjcyXHU1RjE1XHUzMDZGNDAlXHUzMDkyXHU4RDg1XHUzMDQ4XHUzMDhCXHUzMDUzXHUzMDY4XHUzMDZGXHUzMDY3XHUzMDREXHUzMDdFXHUzMDVCXHUzMDkzJyxcbiAgfSxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy90cmFuc2xhdGlvbnMvZXMtRVMudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvdHJhbnNsYXRpb25zXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3RyYW5zbGF0aW9ucy9lcy1FUy50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuaW1wb3J0IHR5cGUgeyBUcmFuc2xhdGlvbkRhdGEgfSBmcm9tICdAb2JqZWN0c3RhY2svc3BlYy9zeXN0ZW0nO1xuXG4vKipcbiAqIEVzcGFcdTAwRjFvbCAoZXMtRVMpIFx1MjAxNCBDUk0gQXBwIFRyYW5zbGF0aW9uc1xuICpcbiAqIFBlci1sb2NhbGUgZmlsZTogb25lIGZpbGUgcGVyIGxhbmd1YWdlLCBmb2xsb3dpbmcgdGhlIGBwZXJfbG9jYWxlYCBjb252ZW50aW9uLlxuICovXG5leHBvcnQgY29uc3QgZXNFUzogVHJhbnNsYXRpb25EYXRhID0ge1xuICBvYmplY3RzOiB7XG4gICAgYWNjb3VudDoge1xuICAgICAgbGFiZWw6ICdDdWVudGEnLFxuICAgICAgcGx1cmFsTGFiZWw6ICdDdWVudGFzJyxcbiAgICAgIGZpZWxkczoge1xuICAgICAgICBhY2NvdW50X251bWJlcjogeyBsYWJlbDogJ05cdTAwRkFtZXJvIGRlIEN1ZW50YScgfSxcbiAgICAgICAgbmFtZTogeyBsYWJlbDogJ05vbWJyZSBkZSBDdWVudGEnLCBoZWxwOiAnTm9tYnJlIGxlZ2FsIGRlIGxhIGVtcHJlc2EgdSBvcmdhbml6YWNpXHUwMEYzbicgfSxcbiAgICAgICAgdHlwZToge1xuICAgICAgICAgIGxhYmVsOiAnVGlwbycsXG4gICAgICAgICAgb3B0aW9uczogeyBwcm9zcGVjdDogJ1Byb3NwZWN0bycsIGN1c3RvbWVyOiAnQ2xpZW50ZScsIHBhcnRuZXI6ICdTb2NpbycsIGZvcm1lcjogJ0FudGVyaW9yJyB9LFxuICAgICAgICB9LFxuICAgICAgICBpbmR1c3RyeToge1xuICAgICAgICAgIGxhYmVsOiAnSW5kdXN0cmlhJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICB0ZWNobm9sb2d5OiAnVGVjbm9sb2dcdTAwRURhJywgZmluYW5jZTogJ0ZpbmFuemFzJywgaGVhbHRoY2FyZTogJ1NhbHVkJyxcbiAgICAgICAgICAgIHJldGFpbDogJ0NvbWVyY2lvJywgbWFudWZhY3R1cmluZzogJ01hbnVmYWN0dXJhJywgZWR1Y2F0aW9uOiAnRWR1Y2FjaVx1MDBGM24nLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGFubnVhbF9yZXZlbnVlOiB7IGxhYmVsOiAnSW5ncmVzb3MgQW51YWxlcycgfSxcbiAgICAgICAgbnVtYmVyX29mX2VtcGxveWVlczogeyBsYWJlbDogJ05cdTAwRkFtZXJvIGRlIEVtcGxlYWRvcycgfSxcbiAgICAgICAgcGhvbmU6IHsgbGFiZWw6ICdUZWxcdTAwRTlmb25vJyB9LFxuICAgICAgICB3ZWJzaXRlOiB7IGxhYmVsOiAnU2l0aW8gV2ViJyB9LFxuICAgICAgICBiaWxsaW5nX2FkZHJlc3M6IHsgbGFiZWw6ICdEaXJlY2NpXHUwMEYzbiBkZSBGYWN0dXJhY2lcdTAwRjNuJyB9LFxuICAgICAgICBvZmZpY2VfbG9jYXRpb246IHsgbGFiZWw6ICdVYmljYWNpXHUwMEYzbiBkZSBPZmljaW5hJyB9LFxuICAgICAgICBvd25lcjogeyBsYWJlbDogJ1Byb3BpZXRhcmlvIGRlIEN1ZW50YScgfSxcbiAgICAgICAgcGFyZW50X2FjY291bnQ6IHsgbGFiZWw6ICdDdWVudGEgTWF0cml6JyB9LFxuICAgICAgICBkZXNjcmlwdGlvbjogeyBsYWJlbDogJ0Rlc2NyaXBjaVx1MDBGM24nIH0sXG4gICAgICAgIGlzX2FjdGl2ZTogeyBsYWJlbDogJ0FjdGl2bycgfSxcbiAgICAgICAgbGFzdF9hY3Rpdml0eV9kYXRlOiB7IGxhYmVsOiAnRmVjaGEgZGUgXHUwMERBbHRpbWEgQWN0aXZpZGFkJyB9LFxuICAgICAgfSxcbiAgICB9LFxuXG4gICAgY29udGFjdDoge1xuICAgICAgbGFiZWw6ICdDb250YWN0bycsXG4gICAgICBwbHVyYWxMYWJlbDogJ0NvbnRhY3RvcycsXG4gICAgICBmaWVsZHM6IHtcbiAgICAgICAgc2FsdXRhdGlvbjogeyBsYWJlbDogJ1RcdTAwRUR0dWxvJyB9LFxuICAgICAgICBmaXJzdF9uYW1lOiB7IGxhYmVsOiAnTm9tYnJlJyB9LFxuICAgICAgICBsYXN0X25hbWU6IHsgbGFiZWw6ICdBcGVsbGlkbycgfSxcbiAgICAgICAgZnVsbF9uYW1lOiB7IGxhYmVsOiAnTm9tYnJlIENvbXBsZXRvJyB9LFxuICAgICAgICBhY2NvdW50OiB7IGxhYmVsOiAnQ3VlbnRhJyB9LFxuICAgICAgICBlbWFpbDogeyBsYWJlbDogJ0NvcnJlbyBFbGVjdHJcdTAwRjNuaWNvJyB9LFxuICAgICAgICBwaG9uZTogeyBsYWJlbDogJ1RlbFx1MDBFOWZvbm8nIH0sXG4gICAgICAgIG1vYmlsZTogeyBsYWJlbDogJ01cdTAwRjN2aWwnIH0sXG4gICAgICAgIHRpdGxlOiB7IGxhYmVsOiAnQ2FyZ28nIH0sXG4gICAgICAgIGRlcGFydG1lbnQ6IHtcbiAgICAgICAgICBsYWJlbDogJ0RlcGFydGFtZW50bycsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgRXhlY3V0aXZlOiAnRWplY3V0aXZvJywgU2FsZXM6ICdWZW50YXMnLCBNYXJrZXRpbmc6ICdNYXJrZXRpbmcnLFxuICAgICAgICAgICAgRW5naW5lZXJpbmc6ICdJbmdlbmllclx1MDBFRGEnLCBTdXBwb3J0OiAnU29wb3J0ZScsIEZpbmFuY2U6ICdGaW5hbnphcycsXG4gICAgICAgICAgICBIUjogJ1JlY3Vyc29zIEh1bWFub3MnLCBPcGVyYXRpb25zOiAnT3BlcmFjaW9uZXMnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIG93bmVyOiB7IGxhYmVsOiAnUHJvcGlldGFyaW8gZGUgQ29udGFjdG8nIH0sXG4gICAgICAgIGRlc2NyaXB0aW9uOiB7IGxhYmVsOiAnRGVzY3JpcGNpXHUwMEYzbicgfSxcbiAgICAgICAgaXNfcHJpbWFyeTogeyBsYWJlbDogJ0NvbnRhY3RvIFByaW5jaXBhbCcgfSxcbiAgICAgIH0sXG4gICAgfSxcblxuICAgIGxlYWQ6IHtcbiAgICAgIGxhYmVsOiAnUHJvc3BlY3RvJyxcbiAgICAgIHBsdXJhbExhYmVsOiAnUHJvc3BlY3RvcycsXG4gICAgICBmaWVsZHM6IHtcbiAgICAgICAgZmlyc3RfbmFtZTogeyBsYWJlbDogJ05vbWJyZScgfSxcbiAgICAgICAgbGFzdF9uYW1lOiB7IGxhYmVsOiAnQXBlbGxpZG8nIH0sXG4gICAgICAgIGNvbXBhbnk6IHsgbGFiZWw6ICdFbXByZXNhJyB9LFxuICAgICAgICB0aXRsZTogeyBsYWJlbDogJ0NhcmdvJyB9LFxuICAgICAgICBlbWFpbDogeyBsYWJlbDogJ0NvcnJlbyBFbGVjdHJcdTAwRjNuaWNvJyB9LFxuICAgICAgICBwaG9uZTogeyBsYWJlbDogJ1RlbFx1MDBFOWZvbm8nIH0sXG4gICAgICAgIHN0YXR1czoge1xuICAgICAgICAgIGxhYmVsOiAnRXN0YWRvJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBuZXc6ICdOdWV2bycsIGNvbnRhY3RlZDogJ0NvbnRhY3RhZG8nLCBxdWFsaWZpZWQ6ICdDYWxpZmljYWRvJyxcbiAgICAgICAgICAgIHVucXVhbGlmaWVkOiAnTm8gQ2FsaWZpY2FkbycsIGNvbnZlcnRlZDogJ0NvbnZlcnRpZG8nLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGxlYWRfc291cmNlOiB7XG4gICAgICAgICAgbGFiZWw6ICdPcmlnZW4gZGVsIFByb3NwZWN0bycsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgV2ViOiAnV2ViJywgUmVmZXJyYWw6ICdSZWZlcmVuY2lhJywgRXZlbnQ6ICdFdmVudG8nLFxuICAgICAgICAgICAgUGFydG5lcjogJ1NvY2lvJywgQWR2ZXJ0aXNlbWVudDogJ1B1YmxpY2lkYWQnLCAnQ29sZCBDYWxsJzogJ0xsYW1hZGEgZW4gRnJcdTAwRURvJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBvd25lcjogeyBsYWJlbDogJ1Byb3BpZXRhcmlvJyB9LFxuICAgICAgICBpc19jb252ZXJ0ZWQ6IHsgbGFiZWw6ICdDb252ZXJ0aWRvJyB9LFxuICAgICAgICBkZXNjcmlwdGlvbjogeyBsYWJlbDogJ0Rlc2NyaXBjaVx1MDBGM24nIH0sXG4gICAgICB9LFxuICAgIH0sXG5cbiAgICBvcHBvcnR1bml0eToge1xuICAgICAgbGFiZWw6ICdPcG9ydHVuaWRhZCcsXG4gICAgICBwbHVyYWxMYWJlbDogJ09wb3J0dW5pZGFkZXMnLFxuICAgICAgZmllbGRzOiB7XG4gICAgICAgIG5hbWU6IHsgbGFiZWw6ICdOb21icmUgZGUgT3BvcnR1bmlkYWQnIH0sXG4gICAgICAgIGFjY291bnQ6IHsgbGFiZWw6ICdDdWVudGEnIH0sXG4gICAgICAgIHByaW1hcnlfY29udGFjdDogeyBsYWJlbDogJ0NvbnRhY3RvIFByaW5jaXBhbCcgfSxcbiAgICAgICAgb3duZXI6IHsgbGFiZWw6ICdQcm9waWV0YXJpbyBkZSBPcG9ydHVuaWRhZCcgfSxcbiAgICAgICAgYW1vdW50OiB7IGxhYmVsOiAnTW9udG8nIH0sXG4gICAgICAgIGV4cGVjdGVkX3JldmVudWU6IHsgbGFiZWw6ICdJbmdyZXNvIEVzcGVyYWRvJyB9LFxuICAgICAgICBzdGFnZToge1xuICAgICAgICAgIGxhYmVsOiAnRXRhcGEnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHByb3NwZWN0aW5nOiAnUHJvc3BlY2NpXHUwMEYzbicsIHF1YWxpZmljYXRpb246ICdDYWxpZmljYWNpXHUwMEYzbicsXG4gICAgICAgICAgICBuZWVkc19hbmFseXNpczogJ0FuXHUwMEUxbGlzaXMgZGUgTmVjZXNpZGFkZXMnLCBwcm9wb3NhbDogJ1Byb3B1ZXN0YScsXG4gICAgICAgICAgICBuZWdvdGlhdGlvbjogJ05lZ29jaWFjaVx1MDBGM24nLCBjbG9zZWRfd29uOiAnQ2VycmFkYSBHYW5hZGEnLCBjbG9zZWRfbG9zdDogJ0NlcnJhZGEgUGVyZGlkYScsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgcHJvYmFiaWxpdHk6IHsgbGFiZWw6ICdQcm9iYWJpbGlkYWQgKCUpJyB9LFxuICAgICAgICBjbG9zZV9kYXRlOiB7IGxhYmVsOiAnRmVjaGEgZGUgQ2llcnJlJyB9LFxuICAgICAgICB0eXBlOiB7XG4gICAgICAgICAgbGFiZWw6ICdUaXBvJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAnTmV3IEJ1c2luZXNzJzogJ051ZXZvIE5lZ29jaW8nLFxuICAgICAgICAgICAgJ0V4aXN0aW5nIEN1c3RvbWVyIC0gVXBncmFkZSc6ICdDbGllbnRlIEV4aXN0ZW50ZSAtIE1lam9yYScsXG4gICAgICAgICAgICAnRXhpc3RpbmcgQ3VzdG9tZXIgLSBSZW5ld2FsJzogJ0NsaWVudGUgRXhpc3RlbnRlIC0gUmVub3ZhY2lcdTAwRjNuJyxcbiAgICAgICAgICAgICdFeGlzdGluZyBDdXN0b21lciAtIEV4cGFuc2lvbic6ICdDbGllbnRlIEV4aXN0ZW50ZSAtIEV4cGFuc2lcdTAwRjNuJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBmb3JlY2FzdF9jYXRlZ29yeToge1xuICAgICAgICAgIGxhYmVsOiAnQ2F0ZWdvclx1MDBFRGEgZGUgUHJvblx1MDBGM3N0aWNvJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBQaXBlbGluZTogJ1BpcGVsaW5lJywgJ0Jlc3QgQ2FzZSc6ICdNZWpvciBDYXNvJyxcbiAgICAgICAgICAgIENvbW1pdDogJ0NvbXByb21pc28nLCBPbWl0dGVkOiAnT21pdGlkYScsIENsb3NlZDogJ0NlcnJhZGEnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGRlc2NyaXB0aW9uOiB7IGxhYmVsOiAnRGVzY3JpcGNpXHUwMEYzbicgfSxcbiAgICAgICAgbmV4dF9zdGVwOiB7IGxhYmVsOiAnUHJcdTAwRjN4aW1vIFBhc28nIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG5cbiAgYXBwczoge1xuICAgIGNybV9lbnRlcnByaXNlOiB7XG4gICAgICBsYWJlbDogJ0NSTSBFbXByZXNhcmlhbCcsXG4gICAgICBkZXNjcmlwdGlvbjogJ0dlc3RpXHUwMEYzbiBkZSByZWxhY2lvbmVzIGNvbiBjbGllbnRlcyBwYXJhIHZlbnRhcywgc2VydmljaW8geSBtYXJrZXRpbmcnLFxuICAgIH0sXG4gIH0sXG5cbiAgbWVzc2FnZXM6IHtcbiAgICAnY29tbW9uLnNhdmUnOiAnR3VhcmRhcicsXG4gICAgJ2NvbW1vbi5jYW5jZWwnOiAnQ2FuY2VsYXInLFxuICAgICdjb21tb24uZGVsZXRlJzogJ0VsaW1pbmFyJyxcbiAgICAnY29tbW9uLmVkaXQnOiAnRWRpdGFyJyxcbiAgICAnY29tbW9uLmNyZWF0ZSc6ICdDcmVhcicsXG4gICAgJ2NvbW1vbi5zZWFyY2gnOiAnQnVzY2FyJyxcbiAgICAnY29tbW9uLmZpbHRlcic6ICdGaWx0cmFyJyxcbiAgICAnY29tbW9uLmV4cG9ydCc6ICdFeHBvcnRhcicsXG4gICAgJ2NvbW1vbi5iYWNrJzogJ1ZvbHZlcicsXG4gICAgJ2NvbW1vbi5jb25maXJtJzogJ0NvbmZpcm1hcicsXG4gICAgJ25hdi5zYWxlcyc6ICdWZW50YXMnLFxuICAgICduYXYuc2VydmljZSc6ICdTZXJ2aWNpbycsXG4gICAgJ25hdi5tYXJrZXRpbmcnOiAnTWFya2V0aW5nJyxcbiAgICAnbmF2LnByb2R1Y3RzJzogJ1Byb2R1Y3RvcycsXG4gICAgJ25hdi5hbmFseXRpY3MnOiAnQW5hbFx1MDBFRHRpY2EnLFxuICAgICdzdWNjZXNzLnNhdmVkJzogJ1JlZ2lzdHJvIGd1YXJkYWRvIGV4aXRvc2FtZW50ZScsXG4gICAgJ3N1Y2Nlc3MuY29udmVydGVkJzogJ1Byb3NwZWN0byBjb252ZXJ0aWRvIGV4aXRvc2FtZW50ZScsXG4gICAgJ2NvbmZpcm0uZGVsZXRlJzogJ1x1MDBCRkVzdFx1MDBFMSBzZWd1cm8gZGUgcXVlIGRlc2VhIGVsaW1pbmFyIGVzdGUgcmVnaXN0cm8/JyxcbiAgICAnY29uZmlybS5jb252ZXJ0X2xlYWQnOiAnXHUwMEJGQ29udmVydGlyIGVzdGUgcHJvc3BlY3RvIGVuIGN1ZW50YSwgY29udGFjdG8geSBvcG9ydHVuaWRhZD8nLFxuICAgICdlcnJvci5yZXF1aXJlZCc6ICdFc3RlIGNhbXBvIGVzIG9ibGlnYXRvcmlvJyxcbiAgICAnZXJyb3IubG9hZF9mYWlsZWQnOiAnRXJyb3IgYWwgY2FyZ2FyIGxvcyBkYXRvcycsXG4gIH0sXG5cbiAgdmFsaWRhdGlvbk1lc3NhZ2VzOiB7XG4gICAgYW1vdW50X3JlcXVpcmVkX2Zvcl9jbG9zZWQ6ICdFbCBtb250byBlcyBvYmxpZ2F0b3JpbyBjdWFuZG8gbGEgZXRhcGEgZXMgQ2VycmFkYSBHYW5hZGEnLFxuICAgIGNsb3NlX2RhdGVfcmVxdWlyZWQ6ICdMYSBmZWNoYSBkZSBjaWVycmUgZXMgb2JsaWdhdG9yaWEgcGFyYSBsYXMgb3BvcnR1bmlkYWRlcycsXG4gICAgZGlzY291bnRfbGltaXQ6ICdFbCBkZXNjdWVudG8gbm8gcHVlZGUgc3VwZXJhciBlbCA0MCUnLFxuICB9LFxufTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3RyYW5zbGF0aW9ucy9jcm0udHJhbnNsYXRpb24udHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvdHJhbnNsYXRpb25zXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3RyYW5zbGF0aW9ucy9jcm0udHJhbnNsYXRpb24udHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbmltcG9ydCB0eXBlIHsgVHJhbnNsYXRpb25CdW5kbGUgfSBmcm9tICdAb2JqZWN0c3RhY2svc3BlYy9zeXN0ZW0nO1xuaW1wb3J0IHsgZW4gfSBmcm9tICcuL2VuJztcbmltcG9ydCB7IHpoQ04gfSBmcm9tICcuL3poLUNOJztcbmltcG9ydCB7IGphSlAgfSBmcm9tICcuL2phLUpQJztcbmltcG9ydCB7IGVzRVMgfSBmcm9tICcuL2VzLUVTJztcblxuLyoqXG4gKiBDUk0gQXBwIFx1MjAxNCBJbnRlcm5hdGlvbmFsaXphdGlvbiAoaTE4bilcbiAqXG4gKiBEZW1vbnN0cmF0ZXMgKipwZXItbG9jYWxlIGZpbGUgc3BsaXR0aW5nKiogY29udmVudGlvbjpcbiAqIGVhY2ggbGFuZ3VhZ2UgaXMgZGVmaW5lZCBpbiBpdHMgb3duIGZpbGUgKGBlbi50c2AsIGB6aC1DTi50c2AsIGBqYS1KUC50c2AsIGBlcy1FUy50c2ApXG4gKiBhbmQgYXNzZW1ibGVkIGludG8gYSBzaW5nbGUgYFRyYW5zbGF0aW9uQnVuZGxlYCBoZXJlLlxuICpcbiAqIEVudGVycHJpc2UtZ3JhZGUgbXVsdGktbGFuZ3VhZ2UgdHJhbnNsYXRpb25zIGNvdmVyaW5nOlxuICogLSBDb3JlIENSTSBvYmplY3RzOiBBY2NvdW50LCBDb250YWN0LCBMZWFkLCBPcHBvcnR1bml0eVxuICogLSBTZWxlY3QtZmllbGQgb3B0aW9uIGxhYmVscyBmb3IgZWFjaCBvYmplY3RcbiAqIC0gQXBwICYgbmF2aWdhdGlvbiBncm91cCBsYWJlbHNcbiAqIC0gQ29tbW9uIFVJIG1lc3NhZ2VzLCB2YWxpZGF0aW9uIG1lc3NhZ2VzXG4gKlxuICogU3VwcG9ydGVkIGxvY2FsZXM6IGVuLCB6aC1DTiwgamEtSlAsIGVzLUVTXG4gKi9cbmV4cG9ydCBjb25zdCBDcm1UcmFuc2xhdGlvbnM6IFRyYW5zbGF0aW9uQnVuZGxlID0ge1xuICBlbixcbiAgJ3poLUNOJzogemhDTixcbiAgJ2phLUpQJzogamFKUCxcbiAgJ2VzLUVTJzogZXNFUyxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9kYXRhL2luZGV4LnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL2RhdGFcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvZGF0YS9pbmRleC50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuLyoqXG4gKiBDUk0gU2VlZCBEYXRhXG4gKiBcbiAqIERlbW8gcmVjb3JkcyBmb3IgYWxsIGNvcmUgQ1JNIG9iamVjdHMuXG4gKiBVc2VzIHRoZSBEYXRhc2V0U2NoZW1hIGZvcm1hdCB3aXRoIHVwc2VydCBtb2RlIGZvciBpZGVtcG90ZW50IGxvYWRpbmcuXG4gKi9cbmltcG9ydCB0eXBlIHsgRGF0YXNldElucHV0IH0gZnJvbSAnQG9iamVjdHN0YWNrL3NwZWMvZGF0YSc7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBBY2NvdW50cyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGFjY291bnRzOiBEYXRhc2V0SW5wdXQgPSB7XG4gIG9iamVjdDogJ2FjY291bnQnLFxuICBtb2RlOiAndXBzZXJ0JyxcbiAgZXh0ZXJuYWxJZDogJ25hbWUnLFxuICByZWNvcmRzOiBbXG4gICAge1xuICAgICAgbmFtZTogJ0FjbWUgQ29ycG9yYXRpb24nLFxuICAgICAgdHlwZTogJ2N1c3RvbWVyJyxcbiAgICAgIGluZHVzdHJ5OiAndGVjaG5vbG9neScsXG4gICAgICBhbm51YWxfcmV2ZW51ZTogNTAwMDAwMCxcbiAgICAgIG51bWJlcl9vZl9lbXBsb3llZXM6IDI1MCxcbiAgICAgIHBob25lOiAnKzEtNDE1LTU1NS0wMTAwJyxcbiAgICAgIHdlYnNpdGU6ICdodHRwczovL2FjbWUuZXhhbXBsZS5jb20nLFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJ0dsb2JleCBJbmR1c3RyaWVzJyxcbiAgICAgIHR5cGU6ICdwcm9zcGVjdCcsXG4gICAgICBpbmR1c3RyeTogJ21hbnVmYWN0dXJpbmcnLFxuICAgICAgYW5udWFsX3JldmVudWU6IDEyMDAwMDAwLFxuICAgICAgbnVtYmVyX29mX2VtcGxveWVlczogODAwLFxuICAgICAgcGhvbmU6ICcrMS0zMTItNTU1LTAyMDAnLFxuICAgICAgd2Vic2l0ZTogJ2h0dHBzOi8vZ2xvYmV4LmV4YW1wbGUuY29tJyxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICdJbml0ZWNoIFNvbHV0aW9ucycsXG4gICAgICB0eXBlOiAnY3VzdG9tZXInLFxuICAgICAgaW5kdXN0cnk6ICdmaW5hbmNlJyxcbiAgICAgIGFubnVhbF9yZXZlbnVlOiAzNTAwMDAwLFxuICAgICAgbnVtYmVyX29mX2VtcGxveWVlczogMTUwLFxuICAgICAgcGhvbmU6ICcrMS0yMTItNTU1LTAzMDAnLFxuICAgICAgd2Vic2l0ZTogJ2h0dHBzOi8vaW5pdGVjaC5leGFtcGxlLmNvbScsXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiAnU3RhcmsgTWVkaWNhbCcsXG4gICAgICB0eXBlOiAncGFydG5lcicsXG4gICAgICBpbmR1c3RyeTogJ2hlYWx0aGNhcmUnLFxuICAgICAgYW5udWFsX3JldmVudWU6IDgwMDAwMDAsXG4gICAgICBudW1iZXJfb2ZfZW1wbG95ZWVzOiA0MDAsXG4gICAgICBwaG9uZTogJysxLTYxNy01NTUtMDQwMCcsXG4gICAgICB3ZWJzaXRlOiAnaHR0cHM6Ly9zdGFya21lZC5leGFtcGxlLmNvbScsXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiAnV2F5bmUgRW50ZXJwcmlzZXMnLFxuICAgICAgdHlwZTogJ2N1c3RvbWVyJyxcbiAgICAgIGluZHVzdHJ5OiAndGVjaG5vbG9neScsXG4gICAgICBhbm51YWxfcmV2ZW51ZTogMjUwMDAwMDAsXG4gICAgICBudW1iZXJfb2ZfZW1wbG95ZWVzOiAyMDAwLFxuICAgICAgcGhvbmU6ICcrMS02NTAtNTU1LTA1MDAnLFxuICAgICAgd2Vic2l0ZTogJ2h0dHBzOi8vd2F5bmUuZXhhbXBsZS5jb20nLFxuICAgIH0sXG4gIF1cbn07XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBDb250YWN0cyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGNvbnRhY3RzOiBEYXRhc2V0SW5wdXQgPSB7XG4gIG9iamVjdDogJ2NvbnRhY3QnLFxuICBtb2RlOiAndXBzZXJ0JyxcbiAgZXh0ZXJuYWxJZDogJ2VtYWlsJyxcbiAgcmVjb3JkczogW1xuICAgIHtcbiAgICAgIHNhbHV0YXRpb246ICdNci4nLFxuICAgICAgZmlyc3RfbmFtZTogJ0pvaG4nLFxuICAgICAgbGFzdF9uYW1lOiAnU21pdGgnLFxuICAgICAgZW1haWw6ICdqb2huLnNtaXRoQGFjbWUuZXhhbXBsZS5jb20nLFxuICAgICAgcGhvbmU6ICcrMS00MTUtNTU1LTAxMDEnLFxuICAgICAgdGl0bGU6ICdWUCBvZiBFbmdpbmVlcmluZycsXG4gICAgICBkZXBhcnRtZW50OiAnRW5naW5lZXJpbmcnLFxuICAgIH0sXG4gICAge1xuICAgICAgc2FsdXRhdGlvbjogJ01zLicsXG4gICAgICBmaXJzdF9uYW1lOiAnU2FyYWgnLFxuICAgICAgbGFzdF9uYW1lOiAnSm9obnNvbicsXG4gICAgICBlbWFpbDogJ3NhcmFoLmpAZ2xvYmV4LmV4YW1wbGUuY29tJyxcbiAgICAgIHBob25lOiAnKzEtMzEyLTU1NS0wMjAxJyxcbiAgICAgIHRpdGxlOiAnQ2hpZWYgUHJvY3VyZW1lbnQgT2ZmaWNlcicsXG4gICAgICBkZXBhcnRtZW50OiAnRXhlY3V0aXZlJyxcbiAgICB9LFxuICAgIHtcbiAgICAgIHNhbHV0YXRpb246ICdEci4nLFxuICAgICAgZmlyc3RfbmFtZTogJ01pY2hhZWwnLFxuICAgICAgbGFzdF9uYW1lOiAnQ2hlbicsXG4gICAgICBlbWFpbDogJ21jaGVuQGluaXRlY2guZXhhbXBsZS5jb20nLFxuICAgICAgcGhvbmU6ICcrMS0yMTItNTU1LTAzMDEnLFxuICAgICAgdGl0bGU6ICdEaXJlY3RvciBvZiBPcGVyYXRpb25zJyxcbiAgICAgIGRlcGFydG1lbnQ6ICdPcGVyYXRpb25zJyxcbiAgICB9LFxuICAgIHtcbiAgICAgIHNhbHV0YXRpb246ICdNcy4nLFxuICAgICAgZmlyc3RfbmFtZTogJ0VtaWx5JyxcbiAgICAgIGxhc3RfbmFtZTogJ0RhdmlzJyxcbiAgICAgIGVtYWlsOiAnZW1pbHkuZEBzdGFya21lZC5leGFtcGxlLmNvbScsXG4gICAgICBwaG9uZTogJysxLTYxNy01NTUtMDQwMScsXG4gICAgICB0aXRsZTogJ0hlYWQgb2YgUGFydG5lcnNoaXBzJyxcbiAgICAgIGRlcGFydG1lbnQ6ICdTYWxlcycsXG4gICAgfSxcbiAgICB7XG4gICAgICBzYWx1dGF0aW9uOiAnTXIuJyxcbiAgICAgIGZpcnN0X25hbWU6ICdSb2JlcnQnLFxuICAgICAgbGFzdF9uYW1lOiAnV2lsc29uJyxcbiAgICAgIGVtYWlsOiAncndpbHNvbkB3YXluZS5leGFtcGxlLmNvbScsXG4gICAgICBwaG9uZTogJysxLTY1MC01NTUtMDUwMScsXG4gICAgICB0aXRsZTogJ0NUTycsXG4gICAgICBkZXBhcnRtZW50OiAnRW5naW5lZXJpbmcnLFxuICAgIH0sXG4gIF1cbn07XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBMZWFkcyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGxlYWRzOiBEYXRhc2V0SW5wdXQgPSB7XG4gIG9iamVjdDogJ2xlYWQnLFxuICBtb2RlOiAndXBzZXJ0JyxcbiAgZXh0ZXJuYWxJZDogJ2VtYWlsJyxcbiAgcmVjb3JkczogW1xuICAgIHtcbiAgICAgIGZpcnN0X25hbWU6ICdBbGljZScsXG4gICAgICBsYXN0X25hbWU6ICdNYXJ0aW5leicsXG4gICAgICBjb21wYW55OiAnTmV4dEdlbiBSZXRhaWwnLFxuICAgICAgZW1haWw6ICdhbGljZUBuZXh0Z2VucmV0YWlsLmV4YW1wbGUuY29tJyxcbiAgICAgIHBob25lOiAnKzEtNTAzLTU1NS0wNjAwJyxcbiAgICAgIHN0YXR1czogJ25ldycsXG4gICAgICBzb3VyY2U6ICd3ZWJzaXRlJyxcbiAgICAgIGluZHVzdHJ5OiAnUmV0YWlsJyxcbiAgICB9LFxuICAgIHtcbiAgICAgIGZpcnN0X25hbWU6ICdEYXZpZCcsXG4gICAgICBsYXN0X25hbWU6ICdLaW0nLFxuICAgICAgY29tcGFueTogJ0VkdVRlY2ggTGFicycsXG4gICAgICBlbWFpbDogJ2RraW1AZWR1dGVjaGxhYnMuZXhhbXBsZS5jb20nLFxuICAgICAgcGhvbmU6ICcrMS00MDgtNTU1LTA3MDAnLFxuICAgICAgc3RhdHVzOiAnY29udGFjdGVkJyxcbiAgICAgIHNvdXJjZTogJ3JlZmVycmFsJyxcbiAgICAgIGluZHVzdHJ5OiAnRWR1Y2F0aW9uJyxcbiAgICB9LFxuICAgIHtcbiAgICAgIGZpcnN0X25hbWU6ICdMaXNhJyxcbiAgICAgIGxhc3RfbmFtZTogJ1Rob21wc29uJyxcbiAgICAgIGNvbXBhbnk6ICdDbG91ZEZpcnN0IEluYycsXG4gICAgICBlbWFpbDogJ2xpc2EudEBjbG91ZGZpcnN0LmV4YW1wbGUuY29tJyxcbiAgICAgIHBob25lOiAnKzEtMjA2LTU1NS0wODAwJyxcbiAgICAgIHN0YXR1czogJ3F1YWxpZmllZCcsXG4gICAgICBzb3VyY2U6ICd0cmFkZV9zaG93JyxcbiAgICAgIGluZHVzdHJ5OiAnVGVjaG5vbG9neScsXG4gICAgfSxcbiAgXVxufTtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIE9wcG9ydHVuaXRpZXMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBvcHBvcnR1bml0aWVzOiBEYXRhc2V0SW5wdXQgPSB7XG4gIG9iamVjdDogJ29wcG9ydHVuaXR5JyxcbiAgbW9kZTogJ3Vwc2VydCcsXG4gIGV4dGVybmFsSWQ6ICduYW1lJyxcbiAgcmVjb3JkczogW1xuICAgIHtcbiAgICAgIG5hbWU6ICdBY21lIFBsYXRmb3JtIFVwZ3JhZGUnLFxuICAgICAgYW1vdW50OiAxNTAwMDAsXG4gICAgICBzdGFnZTogJ3Byb3Bvc2FsJyxcbiAgICAgIHByb2JhYmlsaXR5OiA2MCxcbiAgICAgIGNsb3NlX2RhdGU6IG5ldyBEYXRlKERhdGUubm93KCkgKyA4NjQwMDAwMCAqIDMwKSxcbiAgICAgIHR5cGU6ICdleGlzdGluZ19idXNpbmVzcycsXG4gICAgICBmb3JlY2FzdF9jYXRlZ29yeTogJ3BpcGVsaW5lJyxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICdHbG9iZXggTWFudWZhY3R1cmluZyBTdWl0ZScsXG4gICAgICBhbW91bnQ6IDUwMDAwMCxcbiAgICAgIHN0YWdlOiAncXVhbGlmaWNhdGlvbicsXG4gICAgICBwcm9iYWJpbGl0eTogMzAsXG4gICAgICBjbG9zZV9kYXRlOiBuZXcgRGF0ZShEYXRlLm5vdygpICsgODY0MDAwMDAgKiA2MCksXG4gICAgICB0eXBlOiAnbmV3X2J1c2luZXNzJyxcbiAgICAgIGZvcmVjYXN0X2NhdGVnb3J5OiAncGlwZWxpbmUnLFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJ1dheW5lIEVudGVycHJpc2UgTGljZW5zZScsXG4gICAgICBhbW91bnQ6IDEyMDAwMDAsXG4gICAgICBzdGFnZTogJ25lZ290aWF0aW9uJyxcbiAgICAgIHByb2JhYmlsaXR5OiA3NSxcbiAgICAgIGNsb3NlX2RhdGU6IG5ldyBEYXRlKERhdGUubm93KCkgKyA4NjQwMDAwMCAqIDE0KSxcbiAgICAgIHR5cGU6ICduZXdfYnVzaW5lc3MnLFxuICAgICAgZm9yZWNhc3RfY2F0ZWdvcnk6ICdjb21taXQnLFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJ0luaXRlY2ggQ2xvdWQgTWlncmF0aW9uJyxcbiAgICAgIGFtb3VudDogODAwMDAsXG4gICAgICBzdGFnZTogJ25lZWRzX2FuYWx5c2lzJyxcbiAgICAgIHByb2JhYmlsaXR5OiAyNSxcbiAgICAgIGNsb3NlX2RhdGU6IG5ldyBEYXRlKERhdGUubm93KCkgKyA4NjQwMDAwMCAqIDQ1KSxcbiAgICAgIHR5cGU6ICdleGlzdGluZ19idXNpbmVzcycsXG4gICAgICBmb3JlY2FzdF9jYXRlZ29yeTogJ2Jlc3RfY2FzZScsXG4gICAgfSxcbiAgXVxufTtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFByb2R1Y3RzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgcHJvZHVjdHM6IERhdGFzZXRJbnB1dCA9IHtcbiAgb2JqZWN0OiAncHJvZHVjdCcsXG4gIG1vZGU6ICd1cHNlcnQnLFxuICBleHRlcm5hbElkOiAnbmFtZScsXG4gIHJlY29yZHM6IFtcbiAgICB7XG4gICAgICBuYW1lOiAnT2JqZWN0U3RhY2sgUGxhdGZvcm0nLFxuICAgICAgY2F0ZWdvcnk6ICdzb2Z0d2FyZScsXG4gICAgICBmYW1pbHk6ICdlbnRlcnByaXNlJyxcbiAgICAgIGxpc3RfcHJpY2U6IDUwMDAwLFxuICAgICAgaXNfYWN0aXZlOiB0cnVlLFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJ0Nsb3VkIEhvc3RpbmcgKEFubnVhbCknLFxuICAgICAgY2F0ZWdvcnk6ICdzdWJzY3JpcHRpb24nLFxuICAgICAgZmFtaWx5OiAnY2xvdWQnLFxuICAgICAgbGlzdF9wcmljZTogMTIwMDAsXG4gICAgICBpc19hY3RpdmU6IHRydWUsXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiAnUHJlbWl1bSBTdXBwb3J0JyxcbiAgICAgIGNhdGVnb3J5OiAnc3VwcG9ydCcsXG4gICAgICBmYW1pbHk6ICdzZXJ2aWNlcycsXG4gICAgICBsaXN0X3ByaWNlOiAyNTAwMCxcbiAgICAgIGlzX2FjdGl2ZTogdHJ1ZSxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICdJbXBsZW1lbnRhdGlvbiBTZXJ2aWNlcycsXG4gICAgICBjYXRlZ29yeTogJ3NlcnZpY2UnLFxuICAgICAgZmFtaWx5OiAnc2VydmljZXMnLFxuICAgICAgbGlzdF9wcmljZTogNzUwMDAsXG4gICAgICBpc19hY3RpdmU6IHRydWUsXG4gICAgfSxcbiAgXVxufTtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFRhc2tzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgdGFza3M6IERhdGFzZXRJbnB1dCA9IHtcbiAgb2JqZWN0OiAndGFzaycsXG4gIG1vZGU6ICd1cHNlcnQnLFxuICBleHRlcm5hbElkOiAnc3ViamVjdCcsXG4gIHJlY29yZHM6IFtcbiAgICB7XG4gICAgICBzdWJqZWN0OiAnRm9sbG93IHVwIHdpdGggQWNtZSBvbiBwcm9wb3NhbCcsXG4gICAgICBzdGF0dXM6ICdub3Rfc3RhcnRlZCcsXG4gICAgICBwcmlvcml0eTogJ2hpZ2gnLFxuICAgICAgZHVlX2RhdGU6IG5ldyBEYXRlKERhdGUubm93KCkgKyA4NjQwMDAwMCAqIDIpLFxuICAgIH0sXG4gICAge1xuICAgICAgc3ViamVjdDogJ1NjaGVkdWxlIGRlbW8gZm9yIEdsb2JleCB0ZWFtJyxcbiAgICAgIHN0YXR1czogJ2luX3Byb2dyZXNzJyxcbiAgICAgIHByaW9yaXR5OiAnbm9ybWFsJyxcbiAgICAgIGR1ZV9kYXRlOiBuZXcgRGF0ZShEYXRlLm5vdygpICsgODY0MDAwMDAgKiA1KSxcbiAgICB9LFxuICAgIHtcbiAgICAgIHN1YmplY3Q6ICdQcmVwYXJlIGNvbnRyYWN0IGZvciBXYXluZSBFbnRlcnByaXNlcycsXG4gICAgICBzdGF0dXM6ICdub3Rfc3RhcnRlZCcsXG4gICAgICBwcmlvcml0eTogJ3VyZ2VudCcsXG4gICAgICBkdWVfZGF0ZTogbmV3IERhdGUoRGF0ZS5ub3coKSArIDg2NDAwMDAwKSxcbiAgICB9LFxuICAgIHtcbiAgICAgIHN1YmplY3Q6ICdTZW5kIHdlbGNvbWUgcGFja2FnZSB0byBTdGFyayBNZWRpY2FsJyxcbiAgICAgIHN0YXR1czogJ2NvbXBsZXRlZCcsXG4gICAgICBwcmlvcml0eTogJ2xvdycsXG4gICAgfSxcbiAgICB7XG4gICAgICBzdWJqZWN0OiAnVXBkYXRlIENSTSBwaXBlbGluZSByZXBvcnQnLFxuICAgICAgc3RhdHVzOiAnbm90X3N0YXJ0ZWQnLFxuICAgICAgcHJpb3JpdHk6ICdub3JtYWwnLFxuICAgICAgZHVlX2RhdGU6IG5ldyBEYXRlKERhdGUubm93KCkgKyA4NjQwMDAwMCAqIDcpLFxuICAgIH0sXG4gIF1cbn07XG5cbi8qKiBBbGwgQ1JNIHNlZWQgZGF0YXNldHMgKi9cbmV4cG9ydCBjb25zdCBDcm1TZWVkRGF0YTogRGF0YXNldElucHV0W10gPSBbXG4gIGFjY291bnRzLFxuICBjb250YWN0cyxcbiAgbGVhZHMsXG4gIG9wcG9ydHVuaXRpZXMsXG4gIHByb2R1Y3RzLFxuICB0YXNrcyxcbl07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9zaGFyaW5nL2FjY291bnQuc2hhcmluZy50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9zaGFyaW5nXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3NoYXJpbmcvYWNjb3VudC5zaGFyaW5nLnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG4vKiogU2hhcmUgYWNjb3VudHMgd2l0aCBzYWxlcyBtYW5hZ2Vycy9kaXJlY3RvcnMgYmFzZWQgb24gY3VzdG9tZXIgc3RhdHVzICovXG5leHBvcnQgY29uc3QgQWNjb3VudFRlYW1TaGFyaW5nUnVsZSA9IHtcbiAgbmFtZTogJ2FjY291bnRfdGVhbV9zaGFyaW5nJyxcbiAgbGFiZWw6ICdBY2NvdW50IFRlYW0gU2hhcmluZycsXG4gIG9iamVjdDogJ2FjY291bnQnLFxuICB0eXBlOiAnY3JpdGVyaWEnIGFzIGNvbnN0LFxuICBjb25kaXRpb246ICd0eXBlID0gXCJjdXN0b21lclwiIEFORCBpc19hY3RpdmUgPSB0cnVlJyxcbiAgYWNjZXNzTGV2ZWw6ICdlZGl0JyxcbiAgc2hhcmVkV2l0aDogeyB0eXBlOiAncm9sZScsIHZhbHVlOiAnc2FsZXNfbWFuYWdlcicgfSxcbn07XG5cbi8qKiBUZXJyaXRvcnktQmFzZWQgU2hhcmluZyAoY3JpdGVyaWEtYmFzZWQsIGJ5IGJpbGxpbmcgY291bnRyeSkgKi9cbmV4cG9ydCBjb25zdCBUZXJyaXRvcnlTaGFyaW5nUnVsZXMgPSBbXG4gIHtcbiAgICBuYW1lOiAnbm9ydGhfYW1lcmljYV90ZXJyaXRvcnknLFxuICAgIGxhYmVsOiAnTm9ydGggQW1lcmljYSBUZXJyaXRvcnknLFxuICAgIG9iamVjdDogJ2FjY291bnQnLFxuICAgIHR5cGU6ICdjcml0ZXJpYScgYXMgY29uc3QsXG4gICAgY29uZGl0aW9uOiAnYmlsbGluZ19jb3VudHJ5IElOIChcIlVTXCIsIFwiQ0FcIiwgXCJNWFwiKScsXG4gICAgYWNjZXNzTGV2ZWw6ICdlZGl0JyxcbiAgICBzaGFyZWRXaXRoOiB7IHR5cGU6ICdyb2xlJywgdmFsdWU6ICduYV9zYWxlc190ZWFtJyB9LFxuICB9LFxuICB7XG4gICAgbmFtZTogJ2V1cm9wZV90ZXJyaXRvcnknLFxuICAgIGxhYmVsOiAnRXVyb3BlIFRlcnJpdG9yeScsXG4gICAgb2JqZWN0OiAnYWNjb3VudCcsXG4gICAgdHlwZTogJ2NyaXRlcmlhJyBhcyBjb25zdCxcbiAgICBjb25kaXRpb246ICdiaWxsaW5nX2NvdW50cnkgSU4gKFwiVUtcIiwgXCJERVwiLCBcIkZSXCIsIFwiSVRcIiwgXCJFU1wiKScsXG4gICAgYWNjZXNzTGV2ZWw6ICdlZGl0JyxcbiAgICBzaGFyZWRXaXRoOiB7IHR5cGU6ICdyb2xlJywgdmFsdWU6ICdldV9zYWxlc190ZWFtJyB9LFxuICB9LFxuXTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3NoYXJpbmcvY2FzZS5zaGFyaW5nLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3NoYXJpbmdcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvc2hhcmluZy9jYXNlLnNoYXJpbmcudHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbi8qKiBTaGFyZSBlc2NhbGF0ZWQvY3JpdGljYWwgY2FzZXMgd2l0aCBzZXJ2aWNlIG1hbmFnZXJzICovXG5leHBvcnQgY29uc3QgQ2FzZUVzY2FsYXRpb25TaGFyaW5nUnVsZSA9IHtcbiAgbmFtZTogJ2Nhc2VfZXNjYWxhdGlvbl9zaGFyaW5nJyxcbiAgbGFiZWw6ICdFc2NhbGF0ZWQgQ2FzZXMgU2hhcmluZycsXG4gIG9iamVjdDogJ2Nhc2UnLFxuICB0eXBlOiAnY3JpdGVyaWEnIGFzIGNvbnN0LFxuICBjb25kaXRpb246ICdwcmlvcml0eSA9IFwiY3JpdGljYWxcIiBBTkQgaXNfY2xvc2VkID0gZmFsc2UnLFxuICBhY2Nlc3NMZXZlbDogJ2VkaXQnLFxuICBzaGFyZWRXaXRoOiB7IHR5cGU6ICdyb2xlX2FuZF9zdWJvcmRpbmF0ZXMnLCB2YWx1ZTogJ3NlcnZpY2VfbWFuYWdlcicgfSxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9zaGFyaW5nL2RlZmF1bHRzLnNoYXJpbmcudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvc2hhcmluZ1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9zaGFyaW5nL2RlZmF1bHRzLnNoYXJpbmcudHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbi8qKlxuICogT3JnYW5pemF0aW9uLVdpZGUgRGVmYXVsdHMgKE9XRClcbiAqIERlZmluZSB0aGUgYmFzZWxpbmUgYWNjZXNzIGxldmVsIGZvciBlYWNoIG9iamVjdC5cbiAqL1xuZXhwb3J0IGNvbnN0IE9yZ2FuaXphdGlvbkRlZmF1bHRzID0ge1xuICBsZWFkOiAgICAgICAgeyBpbnRlcm5hbEFjY2VzczogJ3ByaXZhdGUnLCAgICAgICAgICAgICAgZXh0ZXJuYWxBY2Nlc3M6ICdwcml2YXRlJyB9LFxuICBhY2NvdW50OiAgICAgeyBpbnRlcm5hbEFjY2VzczogJ3ByaXZhdGUnLCAgICAgICAgICAgICAgZXh0ZXJuYWxBY2Nlc3M6ICdwcml2YXRlJyB9LFxuICBjb250YWN0OiAgICAgeyBpbnRlcm5hbEFjY2VzczogJ2NvbnRyb2xsZWRfYnlfcGFyZW50JywgZXh0ZXJuYWxBY2Nlc3M6ICdwcml2YXRlJyB9LFxuICBvcHBvcnR1bml0eTogeyBpbnRlcm5hbEFjY2VzczogJ3ByaXZhdGUnLCAgICAgICAgICAgICAgZXh0ZXJuYWxBY2Nlc3M6ICdwcml2YXRlJyB9LFxuICBjYXNlOiAgICAgICAgeyBpbnRlcm5hbEFjY2VzczogJ3ByaXZhdGUnLCAgICAgICAgICAgICAgZXh0ZXJuYWxBY2Nlc3M6ICdwcml2YXRlJyB9LFxuICBjYW1wYWlnbjogICAgeyBpbnRlcm5hbEFjY2VzczogJ3B1YmxpY19yZWFkX29ubHknLCAgICAgZXh0ZXJuYWxBY2Nlc3M6ICdwcml2YXRlJyB9LFxuICBwcm9kdWN0OiAgICAgeyBpbnRlcm5hbEFjY2VzczogJ3B1YmxpY19yZWFkX29ubHknLCAgICAgZXh0ZXJuYWxBY2Nlc3M6ICdwcml2YXRlJyB9LFxuICB0YXNrOiAgICAgICAgeyBpbnRlcm5hbEFjY2VzczogJ3ByaXZhdGUnLCAgICAgICAgICAgICAgZXh0ZXJuYWxBY2Nlc3M6ICdwcml2YXRlJyB9LFxufTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3NoYXJpbmcvb3Bwb3J0dW5pdHkuc2hhcmluZy50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9zaGFyaW5nXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3NoYXJpbmcvb3Bwb3J0dW5pdHkuc2hhcmluZy50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuLyoqIFNoYXJlIGhpZ2gtdmFsdWUgb3BlbiBvcHBvcnR1bml0aWVzIHdpdGggbWFuYWdlbWVudCAqL1xuZXhwb3J0IGNvbnN0IE9wcG9ydHVuaXR5U2FsZXNTaGFyaW5nUnVsZSA9IHtcbiAgbmFtZTogJ29wcG9ydHVuaXR5X3NhbGVzX3NoYXJpbmcnLFxuICBsYWJlbDogJ09wcG9ydHVuaXR5IFNhbGVzIFRlYW0gU2hhcmluZycsXG4gIG9iamVjdDogJ29wcG9ydHVuaXR5JyxcbiAgdHlwZTogJ2NyaXRlcmlhJyBhcyBjb25zdCxcbiAgY29uZGl0aW9uOiAnc3RhZ2UgTk9UIElOIChcImNsb3NlZF93b25cIiwgXCJjbG9zZWRfbG9zdFwiKSBBTkQgYW1vdW50ID49IDEwMDAwMCcsXG4gIGFjY2Vzc0xldmVsOiAncmVhZCcsXG4gIHNoYXJlZFdpdGg6IHsgdHlwZTogJ3JvbGVfYW5kX3N1Ym9yZGluYXRlcycsIHZhbHVlOiAnc2FsZXNfZGlyZWN0b3InIH0sXG59O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLWNybS9zcmMvc2hhcmluZy9yb2xlLWhpZXJhcmNoeS50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtY3JtL3NyYy9zaGFyaW5nXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC1jcm0vc3JjL3NoYXJpbmcvcm9sZS1oaWVyYXJjaHkudHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbi8qKiBDUk0gUm9sZSBIaWVyYXJjaHkgKi9cbmV4cG9ydCBjb25zdCBSb2xlSGllcmFyY2h5ID0ge1xuICBuYW1lOiAnY3JtX3JvbGVfaGllcmFyY2h5JyxcbiAgbGFiZWw6ICdDUk0gUm9sZSBIaWVyYXJjaHknLFxuICByb2xlczogW1xuICAgIHsgbmFtZTogJ2V4ZWN1dGl2ZScsICAgICAgICAgIGxhYmVsOiAnRXhlY3V0aXZlJywgICAgICAgICAgICBwYXJlbnRSb2xlOiBudWxsIH0sXG4gICAgeyBuYW1lOiAnc2FsZXNfZGlyZWN0b3InLCAgICAgbGFiZWw6ICdTYWxlcyBEaXJlY3RvcicsICAgICAgIHBhcmVudFJvbGU6ICdleGVjdXRpdmUnIH0sXG4gICAgeyBuYW1lOiAnc2FsZXNfbWFuYWdlcicsICAgICAgbGFiZWw6ICdTYWxlcyBNYW5hZ2VyJywgICAgICAgIHBhcmVudFJvbGU6ICdzYWxlc19kaXJlY3RvcicgfSxcbiAgICB7IG5hbWU6ICdzYWxlc19yZXAnLCAgICAgICAgICBsYWJlbDogJ1NhbGVzIFJlcHJlc2VudGF0aXZlJywgcGFyZW50Um9sZTogJ3NhbGVzX21hbmFnZXInIH0sXG4gICAgeyBuYW1lOiAnc2VydmljZV9kaXJlY3RvcicsICAgbGFiZWw6ICdTZXJ2aWNlIERpcmVjdG9yJywgICAgIHBhcmVudFJvbGU6ICdleGVjdXRpdmUnIH0sXG4gICAgeyBuYW1lOiAnc2VydmljZV9tYW5hZ2VyJywgICAgbGFiZWw6ICdTZXJ2aWNlIE1hbmFnZXInLCAgICAgIHBhcmVudFJvbGU6ICdzZXJ2aWNlX2RpcmVjdG9yJyB9LFxuICAgIHsgbmFtZTogJ3NlcnZpY2VfYWdlbnQnLCAgICAgIGxhYmVsOiAnU2VydmljZSBBZ2VudCcsICAgICAgICBwYXJlbnRSb2xlOiAnc2VydmljZV9tYW5hZ2VyJyB9LFxuICAgIHsgbmFtZTogJ21hcmtldGluZ19kaXJlY3RvcicsIGxhYmVsOiAnTWFya2V0aW5nIERpcmVjdG9yJywgICBwYXJlbnRSb2xlOiAnZXhlY3V0aXZlJyB9LFxuICAgIHsgbmFtZTogJ21hcmtldGluZ19tYW5hZ2VyJywgIGxhYmVsOiAnTWFya2V0aW5nIE1hbmFnZXInLCAgICBwYXJlbnRSb2xlOiAnbWFya2V0aW5nX2RpcmVjdG9yJyB9LFxuICAgIHsgbmFtZTogJ21hcmtldGluZ191c2VyJywgICAgIGxhYmVsOiAnTWFya2V0aW5nIFVzZXInLCAgICAgICBwYXJlbnRSb2xlOiAnbWFya2V0aW5nX21hbmFnZXInIH0sXG4gIF0sXG59O1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLXRvZG8vb2JqZWN0c3RhY2suY29uZmlnLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC10b2RvXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC10b2RvL29iamVjdHN0YWNrLmNvbmZpZy50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuaW1wb3J0IHsgZGVmaW5lU3RhY2sgfSBmcm9tICdAb2JqZWN0c3RhY2svc3BlYyc7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBCYXJyZWwgSW1wb3J0cyAob25lIHBlciBtZXRhZGF0YSB0eXBlKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmltcG9ydCAqIGFzIG9iamVjdHMgZnJvbSAnLi9zcmMvb2JqZWN0cyc7XG5pbXBvcnQgKiBhcyBhY3Rpb25zIGZyb20gJy4vc3JjL2FjdGlvbnMnO1xuaW1wb3J0ICogYXMgZGFzaGJvYXJkcyBmcm9tICcuL3NyYy9kYXNoYm9hcmRzJztcbmltcG9ydCAqIGFzIHJlcG9ydHMgZnJvbSAnLi9zcmMvcmVwb3J0cyc7XG5pbXBvcnQgKiBhcyBmbG93cyBmcm9tICcuL3NyYy9mbG93cyc7XG5pbXBvcnQgKiBhcyBhcHBzIGZyb20gJy4vc3JjL2FwcHMnO1xuaW1wb3J0ICogYXMgdHJhbnNsYXRpb25zIGZyb20gJy4vc3JjL3RyYW5zbGF0aW9ucyc7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBBY3Rpb24gSGFuZGxlciBSZWdpc3RyYXRpb24gKHJ1bnRpbWUgbGlmZWN5Y2xlKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIEhhbmRsZXJzIGFyZSB3aXJlZCBzZXBhcmF0ZWx5IGZyb20gbWV0YWRhdGEuIFRoZSBgb25FbmFibGVgIGV4cG9ydFxuLy8gaXMgY2FsbGVkIGJ5IHRoZSBrZXJuZWwncyBBcHBQbHVnaW4gYWZ0ZXIgdGhlIGVuZ2luZSBpcyByZWFkeS5cbi8vIFNlZTogc3JjL2FjdGlvbnMvcmVnaXN0ZXItaGFuZGxlcnMudHMgZm9yIHRoZSBmdWxsIHJlZ2lzdHJhdGlvbiBmbG93LlxuaW1wb3J0IHsgcmVnaXN0ZXJUYXNrQWN0aW9uSGFuZGxlcnMgfSBmcm9tICcuL3NyYy9hY3Rpb25zL3JlZ2lzdGVyLWhhbmRsZXJzJztcblxuLyoqXG4gKiBQbHVnaW4gbGlmZWN5Y2xlIGhvb2sgXHUyMDE0IGNhbGxlZCBieSBBcHBQbHVnaW4gd2hlbiB0aGUgZW5naW5lIGlzIHJlYWR5LlxuICogVGhpcyBpcyB3aGVyZSBhY3Rpb24gaGFuZGxlcnMgYXJlIHJlZ2lzdGVyZWQgb24gdGhlIE9iamVjdFFMIGVuZ2luZS5cbiAqL1xuZXhwb3J0IGNvbnN0IG9uRW5hYmxlID0gYXN5bmMgKGN0eDogeyBxbDogeyByZWdpc3RlckFjdGlvbjogKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdm9pZCB9IH0pID0+IHtcbiAgcmVnaXN0ZXJUYXNrQWN0aW9uSGFuZGxlcnMoY3R4LnFsKTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZVN0YWNrKHtcbiAgbWFuaWZlc3Q6IHtcbiAgICBpZDogJ2NvbS5leGFtcGxlLnRvZG8nLFxuICAgIG5hbWVzcGFjZTogJ3RvZG8nLFxuICAgIHZlcnNpb246ICcyLjAuMCcsXG4gICAgdHlwZTogJ2FwcCcsXG4gICAgbmFtZTogJ1RvZG8gTWFuYWdlcicsXG4gICAgZGVzY3JpcHRpb246ICdBIGNvbXByZWhlbnNpdmUgVG9kbyBhcHAgZGVtb25zdHJhdGluZyBPYmplY3RTdGFjayBQcm90b2NvbCBmZWF0dXJlcyBpbmNsdWRpbmcgYXV0b21hdGlvbiwgZGFzaGJvYXJkcywgYW5kIHJlcG9ydHMnLFxuICB9LFxuXG4gIC8vIFNlZWQgRGF0YSAodG9wLWxldmVsLCByZWdpc3RlcmVkIGFzIG1ldGFkYXRhKVxuICBkYXRhOiBbXG4gICAge1xuICAgICAgb2JqZWN0OiAndGFzaycsXG4gICAgICBtb2RlOiAndXBzZXJ0JyBhcyBjb25zdCxcbiAgICAgIGV4dGVybmFsSWQ6ICdzdWJqZWN0JyxcbiAgICAgIHJlY29yZHM6IFtcbiAgICAgICAgeyBzdWJqZWN0OiAnTGVhcm4gT2JqZWN0U3RhY2snLCBzdGF0dXM6ICdjb21wbGV0ZWQnLCBwcmlvcml0eTogJ2hpZ2gnLCBjYXRlZ29yeTogJ1dvcmsnIH0sXG4gICAgICAgIHsgc3ViamVjdDogJ0J1aWxkIGEgY29vbCBhcHAnLCBzdGF0dXM6ICdpbl9wcm9ncmVzcycsIHByaW9yaXR5OiAnbm9ybWFsJywgY2F0ZWdvcnk6ICdXb3JrJywgZHVlX2RhdGU6IG5ldyBEYXRlKERhdGUubm93KCkgKyA4NjQwMDAwMCAqIDMpIH0sXG4gICAgICAgIHsgc3ViamVjdDogJ1JldmlldyBQUiAjMTAyJywgc3RhdHVzOiAnY29tcGxldGVkJywgcHJpb3JpdHk6ICdoaWdoJywgY2F0ZWdvcnk6ICdXb3JrJyB9LFxuICAgICAgICB7IHN1YmplY3Q6ICdXcml0ZSBEb2N1bWVudGF0aW9uJywgc3RhdHVzOiAnbm90X3N0YXJ0ZWQnLCBwcmlvcml0eTogJ25vcm1hbCcsIGNhdGVnb3J5OiAnV29yaycsIGR1ZV9kYXRlOiBuZXcgRGF0ZShEYXRlLm5vdygpICsgODY0MDAwMDApIH0sXG4gICAgICAgIHsgc3ViamVjdDogJ0ZpeCBTZXJ2ZXIgYnVnJywgc3RhdHVzOiAnd2FpdGluZycsIHByaW9yaXR5OiAndXJnZW50JywgY2F0ZWdvcnk6ICdXb3JrJyB9LFxuICAgICAgICB7IHN1YmplY3Q6ICdCdXkgZ3JvY2VyaWVzJywgc3RhdHVzOiAnbm90X3N0YXJ0ZWQnLCBwcmlvcml0eTogJ2xvdycsIGNhdGVnb3J5OiAnU2hvcHBpbmcnLCBkdWVfZGF0ZTogbmV3IERhdGUoKSB9LFxuICAgICAgICB7IHN1YmplY3Q6ICdTY2hlZHVsZSBkZW50aXN0IGFwcG9pbnRtZW50Jywgc3RhdHVzOiAnbm90X3N0YXJ0ZWQnLCBwcmlvcml0eTogJ25vcm1hbCcsIGNhdGVnb3J5OiAnSGVhbHRoJywgZHVlX2RhdGU6IG5ldyBEYXRlKERhdGUubm93KCkgKyA4NjQwMDAwMCAqIDcpIH0sXG4gICAgICAgIHsgc3ViamVjdDogJ1BheSB1dGlsaXR5IGJpbGxzJywgc3RhdHVzOiAnbm90X3N0YXJ0ZWQnLCBwcmlvcml0eTogJ2hpZ2gnLCBjYXRlZ29yeTogJ0ZpbmFuY2UnLCBkdWVfZGF0ZTogbmV3IERhdGUoRGF0ZS5ub3coKSArIDg2NDAwMDAwICogMikgfSxcbiAgICAgIF1cbiAgICB9XG4gIF0sXG5cbiAgLy8gQXV0by1jb2xsZWN0ZWQgZnJvbSBiYXJyZWwgaW5kZXggZmlsZXMgdmlhIE9iamVjdC52YWx1ZXMoKVxuICBvYmplY3RzOiBPYmplY3QudmFsdWVzKG9iamVjdHMpLFxuICBhY3Rpb25zOiBPYmplY3QudmFsdWVzKGFjdGlvbnMpLFxuICBkYXNoYm9hcmRzOiBPYmplY3QudmFsdWVzKGRhc2hib2FyZHMpLFxuICByZXBvcnRzOiBPYmplY3QudmFsdWVzKHJlcG9ydHMpLFxuICBmbG93czogT2JqZWN0LnZhbHVlcyhmbG93cykgYXMgYW55LFxuICBhcHBzOiBPYmplY3QudmFsdWVzKGFwcHMpLFxuXG4gIC8vIEkxOG4gQ29uZmlndXJhdGlvbiBcdTIwMTQgcGVyLWxvY2FsZSBmaWxlIG9yZ2FuaXphdGlvblxuICBpMThuOiB7XG4gICAgZGVmYXVsdExvY2FsZTogJ2VuJyxcbiAgICBzdXBwb3J0ZWRMb2NhbGVzOiBbJ2VuJywgJ3poLUNOJywgJ2phLUpQJ10sXG4gICAgZmFsbGJhY2tMb2NhbGU6ICdlbicsXG4gICAgZmlsZU9yZ2FuaXphdGlvbjogJ3Blcl9sb2NhbGUnLFxuICB9LFxuXG4gIC8vIEkxOG4gVHJhbnNsYXRpb24gQnVuZGxlcyAoZW4sIHpoLUNOLCBqYS1KUClcbiAgdHJhbnNsYXRpb25zOiBPYmplY3QudmFsdWVzKHRyYW5zbGF0aW9ucyksXG59KTtcblxuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLXRvZG8vc3JjL29iamVjdHMvaW5kZXgudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLXRvZG8vc3JjL29iamVjdHNcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLXRvZG8vc3JjL29iamVjdHMvaW5kZXgudHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbi8qKlxuICogT2JqZWN0IERlZmluaXRpb25zIEJhcnJlbFxuICovXG5leHBvcnQgeyBUYXNrIH0gZnJvbSAnLi90YXNrLm9iamVjdCc7XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtdG9kby9zcmMvb2JqZWN0cy90YXNrLm9iamVjdC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtdG9kby9zcmMvb2JqZWN0c1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtdG9kby9zcmMvb2JqZWN0cy90YXNrLm9iamVjdC50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuaW1wb3J0IHsgT2JqZWN0U2NoZW1hLCBGaWVsZCB9IGZyb20gJ0BvYmplY3RzdGFjay9zcGVjL2RhdGEnO1xuXG5leHBvcnQgY29uc3QgVGFzayA9IE9iamVjdFNjaGVtYS5jcmVhdGUoe1xuICBuYW1lOiAndGFzaycsXG4gIGxhYmVsOiAnVGFzaycsXG4gIHBsdXJhbExhYmVsOiAnVGFza3MnLFxuICBpY29uOiAnY2hlY2stc3F1YXJlJyxcbiAgZGVzY3JpcHRpb246ICdQZXJzb25hbCB0YXNrcyBhbmQgdG8tZG8gaXRlbXMnLFxuICBcbiAgZmllbGRzOiB7XG4gICAgLy8gVGFzayBJbmZvcm1hdGlvblxuICAgIHN1YmplY3Q6IEZpZWxkLnRleHQoe1xuICAgICAgbGFiZWw6ICdTdWJqZWN0JyxcbiAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgc2VhcmNoYWJsZTogdHJ1ZSxcbiAgICAgIG1heExlbmd0aDogMjU1LFxuICAgIH0pLFxuICAgIFxuICAgIGRlc2NyaXB0aW9uOiBGaWVsZC5tYXJrZG93bih7XG4gICAgICBsYWJlbDogJ0Rlc2NyaXB0aW9uJyxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBUYXNrIE1hbmFnZW1lbnRcbiAgICBzdGF0dXM6IHtcbiAgICAgIHR5cGU6ICdzZWxlY3QnLFxuICAgICAgbGFiZWw6ICdTdGF0dXMnLFxuICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICBvcHRpb25zOiBbXG4gICAgICAgIHsgbGFiZWw6ICdOb3QgU3RhcnRlZCcsIHZhbHVlOiAnbm90X3N0YXJ0ZWQnLCBjb2xvcjogJyM4MDgwODAnLCBkZWZhdWx0OiB0cnVlIH0sXG4gICAgICAgIHsgbGFiZWw6ICdJbiBQcm9ncmVzcycsIHZhbHVlOiAnaW5fcHJvZ3Jlc3MnLCBjb2xvcjogJyMzQjgyRjYnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdXYWl0aW5nJywgdmFsdWU6ICd3YWl0aW5nJywgY29sb3I6ICcjRjU5RTBCJyB9LFxuICAgICAgICB7IGxhYmVsOiAnQ29tcGxldGVkJywgdmFsdWU6ICdjb21wbGV0ZWQnLCBjb2xvcjogJyMxMEI5ODEnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdEZWZlcnJlZCcsIHZhbHVlOiAnZGVmZXJyZWQnLCBjb2xvcjogJyM2QjcyODAnIH0sXG4gICAgICBdXG4gICAgfSxcbiAgICBcbiAgICBwcmlvcml0eToge1xuICAgICAgdHlwZTogJ3NlbGVjdCcsXG4gICAgICBsYWJlbDogJ1ByaW9yaXR5JyxcbiAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgb3B0aW9uczogW1xuICAgICAgICB7IGxhYmVsOiAnTG93JywgdmFsdWU6ICdsb3cnLCBjb2xvcjogJyM2MEE1RkEnLCBkZWZhdWx0OiB0cnVlIH0sXG4gICAgICAgIHsgbGFiZWw6ICdOb3JtYWwnLCB2YWx1ZTogJ25vcm1hbCcsIGNvbG9yOiAnIzEwQjk4MScgfSxcbiAgICAgICAgeyBsYWJlbDogJ0hpZ2gnLCB2YWx1ZTogJ2hpZ2gnLCBjb2xvcjogJyNGNTlFMEInIH0sXG4gICAgICAgIHsgbGFiZWw6ICdVcmdlbnQnLCB2YWx1ZTogJ3VyZ2VudCcsIGNvbG9yOiAnI0VGNDQ0NCcgfSxcbiAgICAgIF1cbiAgICB9LFxuICAgIFxuICAgIGNhdGVnb3J5OiBGaWVsZC5zZWxlY3QoWydQZXJzb25hbCcsICdXb3JrJywgJ1Nob3BwaW5nJywgJ0hlYWx0aCcsICdGaW5hbmNlJywgJ090aGVyJ10sIHtcbiAgICAgIGxhYmVsOiAnQ2F0ZWdvcnknLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIERhdGVzXG4gICAgZHVlX2RhdGU6IEZpZWxkLmRhdGUoe1xuICAgICAgbGFiZWw6ICdEdWUgRGF0ZScsXG4gICAgfSksXG4gICAgXG4gICAgcmVtaW5kZXJfZGF0ZTogRmllbGQuZGF0ZXRpbWUoe1xuICAgICAgbGFiZWw6ICdSZW1pbmRlciBEYXRlL1RpbWUnLFxuICAgIH0pLFxuICAgIFxuICAgIGNvbXBsZXRlZF9kYXRlOiBGaWVsZC5kYXRldGltZSh7XG4gICAgICBsYWJlbDogJ0NvbXBsZXRlZCBEYXRlJyxcbiAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIEFzc2lnbm1lbnRcbiAgICBvd25lcjogRmllbGQubG9va3VwKCd1c2VyJywge1xuICAgICAgbGFiZWw6ICdBc3NpZ25lZCBUbycsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBUYWdzXG4gICAgdGFnczoge1xuICAgICAgdHlwZTogJ3NlbGVjdCcsXG4gICAgICBsYWJlbDogJ1RhZ3MnLFxuICAgICAgbXVsdGlwbGU6IHRydWUsXG4gICAgICBvcHRpb25zOiBbXG4gICAgICAgIHsgbGFiZWw6ICdJbXBvcnRhbnQnLCB2YWx1ZTogJ2ltcG9ydGFudCcsIGNvbG9yOiAnI0VGNDQ0NCcgfSxcbiAgICAgICAgeyBsYWJlbDogJ1F1aWNrIFdpbicsIHZhbHVlOiAncXVpY2tfd2luJywgY29sb3I6ICcjMTBCOTgxJyB9LFxuICAgICAgICB7IGxhYmVsOiAnQmxvY2tlZCcsIHZhbHVlOiAnYmxvY2tlZCcsIGNvbG9yOiAnI0Y1OUUwQicgfSxcbiAgICAgICAgeyBsYWJlbDogJ0ZvbGxvdyBVcCcsIHZhbHVlOiAnZm9sbG93X3VwJywgY29sb3I6ICcjM0I4MkY2JyB9LFxuICAgICAgICB7IGxhYmVsOiAnUmV2aWV3JywgdmFsdWU6ICdyZXZpZXcnLCBjb2xvcjogJyM4QjVDRjYnIH0sXG4gICAgICBdXG4gICAgfSxcbiAgICBcbiAgICAvLyBSZWN1cnJlbmNlXG4gICAgaXNfcmVjdXJyaW5nOiBGaWVsZC5ib29sZWFuKHtcbiAgICAgIGxhYmVsOiAnUmVjdXJyaW5nIFRhc2snLFxuICAgICAgZGVmYXVsdFZhbHVlOiBmYWxzZSxcbiAgICB9KSxcbiAgICBcbiAgICByZWN1cnJlbmNlX3R5cGU6IEZpZWxkLnNlbGVjdChbJ0RhaWx5JywgJ1dlZWtseScsICdNb250aGx5JywgJ1llYXJseSddLCB7XG4gICAgICBsYWJlbDogJ1JlY3VycmVuY2UgVHlwZScsXG4gICAgfSksXG4gICAgXG4gICAgcmVjdXJyZW5jZV9pbnRlcnZhbDogRmllbGQubnVtYmVyKHtcbiAgICAgIGxhYmVsOiAnUmVjdXJyZW5jZSBJbnRlcnZhbCcsXG4gICAgICBkZWZhdWx0VmFsdWU6IDEsXG4gICAgICBtaW46IDEsXG4gICAgfSksXG4gICAgXG4gICAgLy8gRmxhZ3NcbiAgICBpc19jb21wbGV0ZWQ6IEZpZWxkLmJvb2xlYW4oe1xuICAgICAgbGFiZWw6ICdJcyBDb21wbGV0ZWQnLFxuICAgICAgZGVmYXVsdFZhbHVlOiBmYWxzZSxcbiAgICAgIHJlYWRvbmx5OiB0cnVlLFxuICAgIH0pLFxuICAgIFxuICAgIGlzX292ZXJkdWU6IEZpZWxkLmJvb2xlYW4oe1xuICAgICAgbGFiZWw6ICdJcyBPdmVyZHVlJyxcbiAgICAgIGRlZmF1bHRWYWx1ZTogZmFsc2UsXG4gICAgICByZWFkb25seTogdHJ1ZSxcbiAgICB9KSxcbiAgICBcbiAgICAvLyBQcm9ncmVzc1xuICAgIHByb2dyZXNzX3BlcmNlbnQ6IEZpZWxkLnBlcmNlbnQoe1xuICAgICAgbGFiZWw6ICdQcm9ncmVzcyAoJSknLFxuICAgICAgbWluOiAwLFxuICAgICAgbWF4OiAxMDAsXG4gICAgICBkZWZhdWx0VmFsdWU6IDAsXG4gICAgfSksXG4gICAgXG4gICAgLy8gVGltZSBUcmFja2luZ1xuICAgIGVzdGltYXRlZF9ob3VyczogRmllbGQubnVtYmVyKHtcbiAgICAgIGxhYmVsOiAnRXN0aW1hdGVkIEhvdXJzJyxcbiAgICAgIHNjYWxlOiAyLFxuICAgICAgbWluOiAwLFxuICAgIH0pLFxuICAgIFxuICAgIGFjdHVhbF9ob3VyczogRmllbGQubnVtYmVyKHtcbiAgICAgIGxhYmVsOiAnQWN0dWFsIEhvdXJzJyxcbiAgICAgIHNjYWxlOiAyLFxuICAgICAgbWluOiAwLFxuICAgIH0pLFxuICAgIFxuICAgIC8vIEFkZGl0aW9uYWwgZmllbGRzXG4gICAgbm90ZXM6IEZpZWxkLnJpY2h0ZXh0KHtcbiAgICAgIGxhYmVsOiAnTm90ZXMnLFxuICAgICAgZGVzY3JpcHRpb246ICdSaWNoIHRleHQgbm90ZXMgd2l0aCBmb3JtYXR0aW5nJyxcbiAgICB9KSxcbiAgICBcbiAgICBjYXRlZ29yeV9jb2xvcjogRmllbGQuY29sb3Ioe1xuICAgICAgbGFiZWw6ICdDYXRlZ29yeSBDb2xvcicsXG4gICAgICBjb2xvckZvcm1hdDogJ2hleCcsXG4gICAgICBwcmVzZXRDb2xvcnM6IFsnI0VGNDQ0NCcsICcjRjU5RTBCJywgJyMxMEI5ODEnLCAnIzNCODJGNicsICcjOEI1Q0Y2J10sXG4gICAgfSksXG4gIH0sXG4gIFxuICBlbmFibGU6IHtcbiAgICB0cmFja0hpc3Rvcnk6IHRydWUsXG4gICAgc2VhcmNoYWJsZTogdHJ1ZSxcbiAgICBhcGlFbmFibGVkOiB0cnVlLFxuICAgIGZpbGVzOiB0cnVlLFxuICAgIGZlZWRzOiB0cnVlLFxuICAgIGFjdGl2aXRpZXM6IHRydWUsXG4gICAgdHJhc2g6IHRydWUsXG4gICAgbXJ1OiB0cnVlLFxuICB9LFxuICBcbiAgdGl0bGVGb3JtYXQ6ICd7c3ViamVjdH0nLFxuICBjb21wYWN0TGF5b3V0OiBbJ3N1YmplY3QnLCAnc3RhdHVzJywgJ3ByaW9yaXR5JywgJ2R1ZV9kYXRlJywgJ293bmVyJ10sXG4gIFxuICB2YWxpZGF0aW9uczogW1xuICAgIHtcbiAgICAgIG5hbWU6ICdjb21wbGV0ZWRfZGF0ZV9yZXF1aXJlZCcsXG4gICAgICB0eXBlOiAnc2NyaXB0JyxcbiAgICAgIHNldmVyaXR5OiAnZXJyb3InLFxuICAgICAgbWVzc2FnZTogJ0NvbXBsZXRlZCBkYXRlIGlzIHJlcXVpcmVkIHdoZW4gc3RhdHVzIGlzIENvbXBsZXRlZCcsXG4gICAgICBjb25kaXRpb246ICdzdGF0dXMgPSBcImNvbXBsZXRlZFwiIEFORCBJU0JMQU5LKGNvbXBsZXRlZF9kYXRlKScsXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiAncmVjdXJyZW5jZV9maWVsZHNfcmVxdWlyZWQnLFxuICAgICAgdHlwZTogJ3NjcmlwdCcsXG4gICAgICBzZXZlcml0eTogJ2Vycm9yJyxcbiAgICAgIG1lc3NhZ2U6ICdSZWN1cnJlbmNlIHR5cGUgaXMgcmVxdWlyZWQgZm9yIHJlY3VycmluZyB0YXNrcycsXG4gICAgICBjb25kaXRpb246ICdpc19yZWN1cnJpbmcgPSB0cnVlIEFORCBJU0JMQU5LKHJlY3VycmVuY2VfdHlwZSknLFxuICAgIH0sXG4gIF0sXG4gIFxuICB3b3JrZmxvd3M6IFtcbiAgICB7XG4gICAgICBuYW1lOiAnc2V0X2NvbXBsZXRlZF9mbGFnJyxcbiAgICAgIG9iamVjdE5hbWU6ICd0YXNrJyxcbiAgICAgIHRyaWdnZXJUeXBlOiAnb25fY3JlYXRlX29yX3VwZGF0ZScsXG4gICAgICBjcml0ZXJpYTogJ0lTQ0hBTkdFRChzdGF0dXMpJyxcbiAgICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICd1cGRhdGVfY29tcGxldGVkX2ZsYWcnLFxuICAgICAgICAgIHR5cGU6ICdmaWVsZF91cGRhdGUnLFxuICAgICAgICAgIGZpZWxkOiAnaXNfY29tcGxldGVkJyxcbiAgICAgICAgICB2YWx1ZTogJ3N0YXR1cyA9IFwiY29tcGxldGVkXCInLFxuICAgICAgICB9XG4gICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJ3NldF9jb21wbGV0ZWRfZGF0ZScsXG4gICAgICBvYmplY3ROYW1lOiAndGFzaycsXG4gICAgICB0cmlnZ2VyVHlwZTogJ29uX3VwZGF0ZScsXG4gICAgICBjcml0ZXJpYTogJ0lTQ0hBTkdFRChzdGF0dXMpIEFORCBzdGF0dXMgPSBcImNvbXBsZXRlZFwiJyxcbiAgICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICdzZXRfZGF0ZScsXG4gICAgICAgICAgdHlwZTogJ2ZpZWxkX3VwZGF0ZScsXG4gICAgICAgICAgZmllbGQ6ICdjb21wbGV0ZWRfZGF0ZScsXG4gICAgICAgICAgdmFsdWU6ICdOT1coKScsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiAnc2V0X3Byb2dyZXNzJyxcbiAgICAgICAgICB0eXBlOiAnZmllbGRfdXBkYXRlJyxcbiAgICAgICAgICBmaWVsZDogJ3Byb2dyZXNzX3BlcmNlbnQnLFxuICAgICAgICAgIHZhbHVlOiAnMTAwJyxcbiAgICAgICAgfVxuICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICdjaGVja19vdmVyZHVlJyxcbiAgICAgIG9iamVjdE5hbWU6ICd0YXNrJyxcbiAgICAgIHRyaWdnZXJUeXBlOiAnb25fY3JlYXRlX29yX3VwZGF0ZScsXG4gICAgICBjcml0ZXJpYTogJ2R1ZV9kYXRlIDwgVE9EQVkoKSBBTkQgaXNfY29tcGxldGVkID0gZmFsc2UnLFxuICAgICAgYWN0aXZlOiB0cnVlLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogJ3NldF9vdmVyZHVlX2ZsYWcnLFxuICAgICAgICAgIHR5cGU6ICdmaWVsZF91cGRhdGUnLFxuICAgICAgICAgIGZpZWxkOiAnaXNfb3ZlcmR1ZScsXG4gICAgICAgICAgdmFsdWU6ICd0cnVlJyxcbiAgICAgICAgfVxuICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICdub3RpZnlfb25fdXJnZW50JyxcbiAgICAgIG9iamVjdE5hbWU6ICd0YXNrJyxcbiAgICAgIHRyaWdnZXJUeXBlOiAnb25fY3JlYXRlX29yX3VwZGF0ZScsXG4gICAgICBjcml0ZXJpYTogJ3ByaW9yaXR5ID0gXCJ1cmdlbnRcIiBBTkQgaXNfY29tcGxldGVkID0gZmFsc2UnLFxuICAgICAgYWN0aXZlOiB0cnVlLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogJ2VtYWlsX293bmVyJyxcbiAgICAgICAgICB0eXBlOiAnZW1haWxfYWxlcnQnLFxuICAgICAgICAgIHRlbXBsYXRlOiAndXJnZW50X3Rhc2tfYWxlcnQnLFxuICAgICAgICAgIHJlY2lwaWVudHM6IFsne293bmVyLmVtYWlsfSddLFxuICAgICAgICB9XG4gICAgICBdLFxuICAgIH0sXG4gIF0sXG59KTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC10b2RvL3NyYy9hY3Rpb25zL2luZGV4LnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC10b2RvL3NyYy9hY3Rpb25zXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC10b2RvL3NyYy9hY3Rpb25zL2luZGV4LnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG4vKipcbiAqIEFjdGlvbiBEZWZpbml0aW9ucyBCYXJyZWxcbiAqXG4gKiBFeHBvcnRzIGFjdGlvbiBtZXRhZGF0YSBkZWZpbml0aW9ucyBvbmx5LiBVc2VkIGJ5IGBPYmplY3QudmFsdWVzKClgIGluXG4gKiBvYmplY3RzdGFjay5jb25maWcudHMgdG8gYXV0by1jb2xsZWN0IGFsbCBhY3Rpb24gZGVjbGFyYXRpb25zIGZvciBkZWZpbmVTdGFjaygpLlxuICpcbiAqICoqSGFuZGxlciBmdW5jdGlvbnMqKiBhcmUgZXhwb3J0ZWQgZnJvbSBgLi9oYW5kbGVycy9gIFx1MjAxNCBzZWUgcmVnaXN0ZXItaGFuZGxlcnMudHNcbiAqIGZvciB0aGUgY29tcGxldGUgcmVnaXN0cmF0aW9uIGZsb3cuXG4gKi9cbmV4cG9ydCB7XG4gIENvbXBsZXRlVGFza0FjdGlvbixcbiAgU3RhcnRUYXNrQWN0aW9uLFxuICBEZWZlclRhc2tBY3Rpb24sXG4gIFNldFJlbWluZGVyQWN0aW9uLFxuICBDbG9uZVRhc2tBY3Rpb24sXG4gIE1hc3NDb21wbGV0ZVRhc2tzQWN0aW9uLFxuICBEZWxldGVDb21wbGV0ZWRBY3Rpb24sXG4gIEV4cG9ydFRvQ3N2QWN0aW9uLFxufSBmcm9tICcuL3Rhc2suYWN0aW9ucyc7XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtdG9kby9zcmMvYWN0aW9ucy90YXNrLmFjdGlvbnMudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLXRvZG8vc3JjL2FjdGlvbnNcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLXRvZG8vc3JjL2FjdGlvbnMvdGFzay5hY3Rpb25zLnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5pbXBvcnQgdHlwZSB7IEFjdGlvbiB9IGZyb20gJ0BvYmplY3RzdGFjay9zcGVjL3VpJztcblxuLyoqIE1hcmsgVGFzayBhcyBDb21wbGV0ZSAqL1xuZXhwb3J0IGNvbnN0IENvbXBsZXRlVGFza0FjdGlvbjogQWN0aW9uID0ge1xuICBuYW1lOiAnY29tcGxldGVfdGFzaycsXG4gIGxhYmVsOiAnTWFyayBDb21wbGV0ZScsXG4gIG9iamVjdE5hbWU6ICd0YXNrJyxcbiAgaWNvbjogJ2NoZWNrLWNpcmNsZScsXG4gIHR5cGU6ICdzY3JpcHQnLFxuICB0YXJnZXQ6ICdjb21wbGV0ZVRhc2snLFxuICBsb2NhdGlvbnM6IFsncmVjb3JkX2hlYWRlcicsICdsaXN0X2l0ZW0nXSxcbiAgc3VjY2Vzc01lc3NhZ2U6ICdUYXNrIG1hcmtlZCBhcyBjb21wbGV0ZSEnLFxuICByZWZyZXNoQWZ0ZXI6IHRydWUsXG59O1xuXG4vKiogTWFyayBUYXNrIGFzIEluIFByb2dyZXNzICovXG5leHBvcnQgY29uc3QgU3RhcnRUYXNrQWN0aW9uOiBBY3Rpb24gPSB7XG4gIG5hbWU6ICdzdGFydF90YXNrJyxcbiAgbGFiZWw6ICdTdGFydCBUYXNrJyxcbiAgb2JqZWN0TmFtZTogJ3Rhc2snLFxuICBpY29uOiAncGxheS1jaXJjbGUnLFxuICB0eXBlOiAnc2NyaXB0JyxcbiAgdGFyZ2V0OiAnc3RhcnRUYXNrJyxcbiAgbG9jYXRpb25zOiBbJ3JlY29yZF9oZWFkZXInLCAnbGlzdF9pdGVtJ10sXG4gIHN1Y2Nlc3NNZXNzYWdlOiAnVGFzayBzdGFydGVkIScsXG4gIHJlZnJlc2hBZnRlcjogdHJ1ZSxcbn07XG5cbi8qKiBEZWZlciBUYXNrICovXG5leHBvcnQgY29uc3QgRGVmZXJUYXNrQWN0aW9uOiBBY3Rpb24gPSB7XG4gIG5hbWU6ICdkZWZlcl90YXNrJyxcbiAgbGFiZWw6ICdEZWZlciBUYXNrJyxcbiAgb2JqZWN0TmFtZTogJ3Rhc2snLFxuICBpY29uOiAnY2xvY2snLFxuICB0eXBlOiAnbW9kYWwnLFxuICB0YXJnZXQ6ICdkZWZlcl90YXNrX21vZGFsJyxcbiAgbG9jYXRpb25zOiBbJ3JlY29yZF9oZWFkZXInXSxcbiAgcGFyYW1zOiBbXG4gICAge1xuICAgICAgbmFtZTogJ25ld19kdWVfZGF0ZScsXG4gICAgICBsYWJlbDogJ05ldyBEdWUgRGF0ZScsXG4gICAgICB0eXBlOiAnZGF0ZScsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICdyZWFzb24nLFxuICAgICAgbGFiZWw6ICdSZWFzb24gZm9yIERlZmVycmFsJyxcbiAgICAgIHR5cGU6ICd0ZXh0YXJlYScsXG4gICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgfVxuICBdLFxuICBzdWNjZXNzTWVzc2FnZTogJ1Rhc2sgZGVmZXJyZWQgc3VjY2Vzc2Z1bGx5IScsXG4gIHJlZnJlc2hBZnRlcjogdHJ1ZSxcbn07XG5cbi8qKiBTZXQgUmVtaW5kZXIgKi9cbmV4cG9ydCBjb25zdCBTZXRSZW1pbmRlckFjdGlvbjogQWN0aW9uID0ge1xuICBuYW1lOiAnc2V0X3JlbWluZGVyJyxcbiAgbGFiZWw6ICdTZXQgUmVtaW5kZXInLFxuICBvYmplY3ROYW1lOiAndGFzaycsXG4gIGljb246ICdiZWxsJyxcbiAgdHlwZTogJ21vZGFsJyxcbiAgdGFyZ2V0OiAnc2V0X3JlbWluZGVyX21vZGFsJyxcbiAgbG9jYXRpb25zOiBbJ3JlY29yZF9oZWFkZXInLCAnbGlzdF9pdGVtJ10sXG4gIHBhcmFtczogW1xuICAgIHtcbiAgICAgIG5hbWU6ICdyZW1pbmRlcl9kYXRlJyxcbiAgICAgIGxhYmVsOiAnUmVtaW5kZXIgRGF0ZS9UaW1lJyxcbiAgICAgIHR5cGU6ICdkYXRldGltZScsXG4gICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICB9XG4gIF0sXG4gIHN1Y2Nlc3NNZXNzYWdlOiAnUmVtaW5kZXIgc2V0IScsXG4gIHJlZnJlc2hBZnRlcjogdHJ1ZSxcbn07XG5cbi8qKiBDbG9uZSBUYXNrICovXG5leHBvcnQgY29uc3QgQ2xvbmVUYXNrQWN0aW9uOiBBY3Rpb24gPSB7XG4gIG5hbWU6ICdjbG9uZV90YXNrJyxcbiAgbGFiZWw6ICdDbG9uZSBUYXNrJyxcbiAgb2JqZWN0TmFtZTogJ3Rhc2snLFxuICBpY29uOiAnY29weScsXG4gIHR5cGU6ICdzY3JpcHQnLFxuICB0YXJnZXQ6ICdjbG9uZVRhc2snLFxuICBsb2NhdGlvbnM6IFsncmVjb3JkX2hlYWRlciddLFxuICBzdWNjZXNzTWVzc2FnZTogJ1Rhc2sgY2xvbmVkIHN1Y2Nlc3NmdWxseSEnLFxuICByZWZyZXNoQWZ0ZXI6IHRydWUsXG59O1xuXG4vKiogTWFzcyBDb21wbGV0ZSBUYXNrcyAqL1xuZXhwb3J0IGNvbnN0IE1hc3NDb21wbGV0ZVRhc2tzQWN0aW9uOiBBY3Rpb24gPSB7XG4gIG5hbWU6ICdtYXNzX2NvbXBsZXRlJyxcbiAgbGFiZWw6ICdDb21wbGV0ZSBTZWxlY3RlZCcsXG4gIG9iamVjdE5hbWU6ICd0YXNrJyxcbiAgaWNvbjogJ2NoZWNrLXNxdWFyZScsXG4gIHR5cGU6ICdzY3JpcHQnLFxuICB0YXJnZXQ6ICdtYXNzQ29tcGxldGVUYXNrcycsXG4gIGxvY2F0aW9uczogWydsaXN0X3Rvb2xiYXInXSxcbiAgc3VjY2Vzc01lc3NhZ2U6ICdTZWxlY3RlZCB0YXNrcyBtYXJrZWQgYXMgY29tcGxldGUhJyxcbiAgcmVmcmVzaEFmdGVyOiB0cnVlLFxufTtcblxuLyoqIERlbGV0ZSBDb21wbGV0ZWQgVGFza3MgKi9cbmV4cG9ydCBjb25zdCBEZWxldGVDb21wbGV0ZWRBY3Rpb246IEFjdGlvbiA9IHtcbiAgbmFtZTogJ2RlbGV0ZV9jb21wbGV0ZWQnLFxuICBsYWJlbDogJ0RlbGV0ZSBDb21wbGV0ZWQnLFxuICBvYmplY3ROYW1lOiAndGFzaycsXG4gIGljb246ICd0cmFzaC0yJyxcbiAgdHlwZTogJ3NjcmlwdCcsXG4gIHRhcmdldDogJ2RlbGV0ZUNvbXBsZXRlZFRhc2tzJyxcbiAgbG9jYXRpb25zOiBbJ2xpc3RfdG9vbGJhciddLFxuICBzdWNjZXNzTWVzc2FnZTogJ0NvbXBsZXRlZCB0YXNrcyBkZWxldGVkIScsXG4gIHJlZnJlc2hBZnRlcjogdHJ1ZSxcbn07XG5cbi8qKiBFeHBvcnQgVGFza3MgdG8gQ1NWICovXG5leHBvcnQgY29uc3QgRXhwb3J0VG9Dc3ZBY3Rpb246IEFjdGlvbiA9IHtcbiAgbmFtZTogJ2V4cG9ydF9jc3YnLFxuICBsYWJlbDogJ0V4cG9ydCB0byBDU1YnLFxuICBvYmplY3ROYW1lOiAndGFzaycsXG4gIGljb246ICdkb3dubG9hZCcsXG4gIHR5cGU6ICdzY3JpcHQnLFxuICB0YXJnZXQ6ICdleHBvcnRUYXNrc1RvQ1NWJyxcbiAgbG9jYXRpb25zOiBbJ2xpc3RfdG9vbGJhciddLFxuICBzdWNjZXNzTWVzc2FnZTogJ0V4cG9ydCBjb21wbGV0ZWQhJyxcbiAgcmVmcmVzaEFmdGVyOiBmYWxzZSxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtdG9kby9zcmMvZGFzaGJvYXJkcy9pbmRleC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtdG9kby9zcmMvZGFzaGJvYXJkc1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtdG9kby9zcmMvZGFzaGJvYXJkcy9pbmRleC50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuLyoqXG4gKiBEYXNoYm9hcmQgRGVmaW5pdGlvbnMgQmFycmVsXG4gKi9cbmV4cG9ydCB7IFRhc2tEYXNoYm9hcmQgfSBmcm9tICcuL3Rhc2suZGFzaGJvYXJkJztcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC10b2RvL3NyYy9kYXNoYm9hcmRzL3Rhc2suZGFzaGJvYXJkLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC10b2RvL3NyYy9kYXNoYm9hcmRzXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC10b2RvL3NyYy9kYXNoYm9hcmRzL3Rhc2suZGFzaGJvYXJkLnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5pbXBvcnQgdHlwZSB7IERhc2hib2FyZCB9IGZyb20gJ0BvYmplY3RzdGFjay9zcGVjL3VpJztcblxuZXhwb3J0IGNvbnN0IFRhc2tEYXNoYm9hcmQ6IERhc2hib2FyZCA9IHtcbiAgbmFtZTogJ3Rhc2tfZGFzaGJvYXJkJyxcbiAgbGFiZWw6ICdUYXNrIE92ZXJ2aWV3JyxcbiAgZGVzY3JpcHRpb246ICdLZXkgdGFzayBtZXRyaWNzIGFuZCBwcm9kdWN0aXZpdHkgb3ZlcnZpZXcnLFxuICBcbiAgd2lkZ2V0czogW1xuICAgIC8vIFJvdyAxOiBLZXkgTWV0cmljc1xuICAgIHtcbiAgICAgIGlkOiAndG90YWxfdGFza3MnLFxuICAgICAgdGl0bGU6ICdUb3RhbCBUYXNrcycsXG4gICAgICB0eXBlOiAnbWV0cmljJyxcbiAgICAgIG9iamVjdDogJ3Rhc2snLFxuICAgICAgYWdncmVnYXRlOiAnY291bnQnLFxuICAgICAgbGF5b3V0OiB7IHg6IDAsIHk6IDAsIHc6IDMsIGg6IDIgfSxcbiAgICAgIG9wdGlvbnM6IHsgY29sb3I6ICcjM0I4MkY2JyB9XG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2NvbXBsZXRlZF90b2RheScsXG4gICAgICB0aXRsZTogJ0NvbXBsZXRlZCBUb2RheScsXG4gICAgICB0eXBlOiAnbWV0cmljJyxcbiAgICAgIG9iamVjdDogJ3Rhc2snLFxuICAgICAgZmlsdGVyOiB7IGlzX2NvbXBsZXRlZDogdHJ1ZSwgY29tcGxldGVkX2RhdGU6IHsgJGd0ZTogJ3t0b2RheV9zdGFydH0nIH0gfSxcbiAgICAgIGFnZ3JlZ2F0ZTogJ2NvdW50JyxcbiAgICAgIGxheW91dDogeyB4OiAzLCB5OiAwLCB3OiAzLCBoOiAyIH0sXG4gICAgICBvcHRpb25zOiB7IGNvbG9yOiAnIzEwQjk4MScgfVxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdvdmVyZHVlX3Rhc2tzJyxcbiAgICAgIHRpdGxlOiAnT3ZlcmR1ZSBUYXNrcycsXG4gICAgICB0eXBlOiAnbWV0cmljJyxcbiAgICAgIG9iamVjdDogJ3Rhc2snLFxuICAgICAgZmlsdGVyOiB7IGlzX292ZXJkdWU6IHRydWUsIGlzX2NvbXBsZXRlZDogZmFsc2UgfSxcbiAgICAgIGFnZ3JlZ2F0ZTogJ2NvdW50JyxcbiAgICAgIGxheW91dDogeyB4OiA2LCB5OiAwLCB3OiAzLCBoOiAyIH0sXG4gICAgICBvcHRpb25zOiB7IGNvbG9yOiAnI0VGNDQ0NCcgfVxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdjb21wbGV0aW9uX3JhdGUnLFxuICAgICAgdGl0bGU6ICdDb21wbGV0aW9uIFJhdGUnLFxuICAgICAgdHlwZTogJ21ldHJpYycsXG4gICAgICBvYmplY3Q6ICd0YXNrJyxcbiAgICAgIGZpbHRlcjogeyBjcmVhdGVkX2RhdGU6IHsgJGd0ZTogJ3tjdXJyZW50X3dlZWtfc3RhcnR9JyB9IH0sXG4gICAgICB2YWx1ZUZpZWxkOiAnaXNfY29tcGxldGVkJyxcbiAgICAgIGFnZ3JlZ2F0ZTogJ2NvdW50JyxcbiAgICAgIGxheW91dDogeyB4OiA5LCB5OiAwLCB3OiAzLCBoOiAyIH0sXG4gICAgICBvcHRpb25zOiB7IHN1ZmZpeDogJyUnLCBjb2xvcjogJyM4QjVDRjYnIH1cbiAgICB9LFxuICAgIFxuICAgIC8vIFJvdyAyOiBUYXNrIERpc3RyaWJ1dGlvblxuICAgIHtcbiAgICAgIGlkOiAndGFza3NfYnlfc3RhdHVzJyxcbiAgICAgIHRpdGxlOiAnVGFza3MgYnkgU3RhdHVzJyxcbiAgICAgIHR5cGU6ICdwaWUnLFxuICAgICAgb2JqZWN0OiAndGFzaycsXG4gICAgICBmaWx0ZXI6IHsgaXNfY29tcGxldGVkOiBmYWxzZSB9LFxuICAgICAgY2F0ZWdvcnlGaWVsZDogJ3N0YXR1cycsXG4gICAgICBhZ2dyZWdhdGU6ICdjb3VudCcsXG4gICAgICBsYXlvdXQ6IHsgeDogMCwgeTogMiwgdzogNiwgaDogNCB9LFxuICAgICAgb3B0aW9uczogeyBzaG93TGVnZW5kOiB0cnVlIH1cbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAndGFza3NfYnlfcHJpb3JpdHknLFxuICAgICAgdGl0bGU6ICdUYXNrcyBieSBQcmlvcml0eScsXG4gICAgICB0eXBlOiAnYmFyJyxcbiAgICAgIG9iamVjdDogJ3Rhc2snLFxuICAgICAgZmlsdGVyOiB7IGlzX2NvbXBsZXRlZDogZmFsc2UgfSxcbiAgICAgIGNhdGVnb3J5RmllbGQ6ICdwcmlvcml0eScsXG4gICAgICBhZ2dyZWdhdGU6ICdjb3VudCcsXG4gICAgICBsYXlvdXQ6IHsgeDogNiwgeTogMiwgdzogNiwgaDogNCB9LFxuICAgICAgb3B0aW9uczogeyBob3Jpem9udGFsOiB0cnVlIH1cbiAgICB9LFxuICAgIFxuICAgIC8vIFJvdyAzOiBUcmVuZHNcbiAgICB7XG4gICAgICBpZDogJ3dlZWtseV90YXNrX2NvbXBsZXRpb24nLFxuICAgICAgdGl0bGU6ICdXZWVrbHkgVGFzayBDb21wbGV0aW9uJyxcbiAgICAgIHR5cGU6ICdsaW5lJyxcbiAgICAgIG9iamVjdDogJ3Rhc2snLFxuICAgICAgZmlsdGVyOiB7IGlzX2NvbXBsZXRlZDogdHJ1ZSwgY29tcGxldGVkX2RhdGU6IHsgJGd0ZTogJ3tsYXN0XzRfd2Vla3N9JyB9IH0sXG4gICAgICBjYXRlZ29yeUZpZWxkOiAnY29tcGxldGVkX2RhdGUnLFxuICAgICAgYWdncmVnYXRlOiAnY291bnQnLFxuICAgICAgbGF5b3V0OiB7IHg6IDAsIHk6IDYsIHc6IDgsIGg6IDQgfSxcbiAgICAgIG9wdGlvbnM6IHsgc2hvd0RhdGFMYWJlbHM6IHRydWUgfVxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICd0YXNrc19ieV9jYXRlZ29yeScsXG4gICAgICB0aXRsZTogJ1Rhc2tzIGJ5IENhdGVnb3J5JyxcbiAgICAgIHR5cGU6ICdkb251dCcsXG4gICAgICBvYmplY3Q6ICd0YXNrJyxcbiAgICAgIGZpbHRlcjogeyBpc19jb21wbGV0ZWQ6IGZhbHNlIH0sXG4gICAgICBjYXRlZ29yeUZpZWxkOiAnY2F0ZWdvcnknLFxuICAgICAgYWdncmVnYXRlOiAnY291bnQnLFxuICAgICAgbGF5b3V0OiB7IHg6IDgsIHk6IDYsIHc6IDQsIGg6IDQgfSxcbiAgICAgIG9wdGlvbnM6IHsgc2hvd0xlZ2VuZDogdHJ1ZSB9XG4gICAgfSxcbiAgICBcbiAgICAvLyBSb3cgNDogVGFibGVzXG4gICAge1xuICAgICAgaWQ6ICdvdmVyZHVlX3Rhc2tzX3RhYmxlJyxcbiAgICAgIHRpdGxlOiAnT3ZlcmR1ZSBUYXNrcycsXG4gICAgICB0eXBlOiAndGFibGUnLFxuICAgICAgb2JqZWN0OiAndGFzaycsXG4gICAgICBmaWx0ZXI6IHsgaXNfb3ZlcmR1ZTogdHJ1ZSwgaXNfY29tcGxldGVkOiBmYWxzZSB9LFxuICAgICAgYWdncmVnYXRlOiAnY291bnQnLFxuICAgICAgbGF5b3V0OiB7IHg6IDAsIHk6IDEwLCB3OiA2LCBoOiA0IH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2R1ZV90b2RheScsXG4gICAgICB0aXRsZTogJ0R1ZSBUb2RheScsXG4gICAgICB0eXBlOiAndGFibGUnLFxuICAgICAgb2JqZWN0OiAndGFzaycsXG4gICAgICBmaWx0ZXI6IHsgZHVlX2RhdGU6ICd7dG9kYXl9JywgaXNfY29tcGxldGVkOiBmYWxzZSB9LFxuICAgICAgYWdncmVnYXRlOiAnY291bnQnLFxuICAgICAgbGF5b3V0OiB7IHg6IDYsIHk6IDEwLCB3OiA2LCBoOiA0IH0sXG4gICAgfSxcbiAgXSxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtdG9kby9zcmMvcmVwb3J0cy9pbmRleC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtdG9kby9zcmMvcmVwb3J0c1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtdG9kby9zcmMvcmVwb3J0cy9pbmRleC50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuLyoqXG4gKiBSZXBvcnQgRGVmaW5pdGlvbnMgQmFycmVsXG4gKi9cbmV4cG9ydCB7XG4gIFRhc2tzQnlTdGF0dXNSZXBvcnQsXG4gIFRhc2tzQnlQcmlvcml0eVJlcG9ydCxcbiAgVGFza3NCeU93bmVyUmVwb3J0LFxuICBPdmVyZHVlVGFza3NSZXBvcnQsXG4gIENvbXBsZXRlZFRhc2tzUmVwb3J0LFxuICBUaW1lVHJhY2tpbmdSZXBvcnQsXG59IGZyb20gJy4vdGFzay5yZXBvcnQnO1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLXRvZG8vc3JjL3JlcG9ydHMvdGFzay5yZXBvcnQudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLXRvZG8vc3JjL3JlcG9ydHNcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLXRvZG8vc3JjL3JlcG9ydHMvdGFzay5yZXBvcnQudHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbmltcG9ydCB0eXBlIHsgUmVwb3J0SW5wdXQgfSBmcm9tICdAb2JqZWN0c3RhY2svc3BlYy91aSc7XG5cbi8qKiBUYXNrcyBieSBTdGF0dXMgUmVwb3J0ICovXG5leHBvcnQgY29uc3QgVGFza3NCeVN0YXR1c1JlcG9ydDogUmVwb3J0SW5wdXQgPSB7XG4gIG5hbWU6ICd0YXNrc19ieV9zdGF0dXMnLFxuICBsYWJlbDogJ1Rhc2tzIGJ5IFN0YXR1cycsXG4gIGRlc2NyaXB0aW9uOiAnU3VtbWFyeSBvZiB0YXNrcyBncm91cGVkIGJ5IHN0YXR1cycsXG4gIG9iamVjdE5hbWU6ICd0YXNrJyxcbiAgdHlwZTogJ3N1bW1hcnknLFxuICBjb2x1bW5zOiBbXG4gICAgeyBmaWVsZDogJ3N1YmplY3QnLCBsYWJlbDogJ1N1YmplY3QnIH0sXG4gICAgeyBmaWVsZDogJ3ByaW9yaXR5JywgbGFiZWw6ICdQcmlvcml0eScgfSxcbiAgICB7IGZpZWxkOiAnZHVlX2RhdGUnLCBsYWJlbDogJ0R1ZSBEYXRlJyB9LFxuICAgIHsgZmllbGQ6ICdvd25lcicsIGxhYmVsOiAnQXNzaWduZWQgVG8nIH0sXG4gIF0sXG4gIGdyb3VwaW5nc0Rvd246IFt7IGZpZWxkOiAnc3RhdHVzJywgc29ydE9yZGVyOiAnYXNjJyB9XSxcbn07XG5cbi8qKiBUYXNrcyBieSBQcmlvcml0eSBSZXBvcnQgKi9cbmV4cG9ydCBjb25zdCBUYXNrc0J5UHJpb3JpdHlSZXBvcnQ6IFJlcG9ydElucHV0ID0ge1xuICBuYW1lOiAndGFza3NfYnlfcHJpb3JpdHknLFxuICBsYWJlbDogJ1Rhc2tzIGJ5IFByaW9yaXR5JyxcbiAgZGVzY3JpcHRpb246ICdTdW1tYXJ5IG9mIHRhc2tzIGdyb3VwZWQgYnkgcHJpb3JpdHkgbGV2ZWwnLFxuICBvYmplY3ROYW1lOiAndGFzaycsXG4gIHR5cGU6ICdzdW1tYXJ5JyxcbiAgY29sdW1uczogW1xuICAgIHsgZmllbGQ6ICdzdWJqZWN0JywgbGFiZWw6ICdTdWJqZWN0JyB9LFxuICAgIHsgZmllbGQ6ICdzdGF0dXMnLCBsYWJlbDogJ1N0YXR1cycgfSxcbiAgICB7IGZpZWxkOiAnZHVlX2RhdGUnLCBsYWJlbDogJ0R1ZSBEYXRlJyB9LFxuICAgIHsgZmllbGQ6ICdjYXRlZ29yeScsIGxhYmVsOiAnQ2F0ZWdvcnknIH0sXG4gIF0sXG4gIGdyb3VwaW5nc0Rvd246IFt7IGZpZWxkOiAncHJpb3JpdHknLCBzb3J0T3JkZXI6ICdkZXNjJyB9XSxcbiAgZmlsdGVyOiB7IGlzX2NvbXBsZXRlZDogZmFsc2UgfSxcbn07XG5cbi8qKiBUYXNrcyBieSBPd25lciBSZXBvcnQgKi9cbmV4cG9ydCBjb25zdCBUYXNrc0J5T3duZXJSZXBvcnQ6IFJlcG9ydElucHV0ID0ge1xuICBuYW1lOiAndGFza3NfYnlfb3duZXInLFxuICBsYWJlbDogJ1Rhc2tzIGJ5IE93bmVyJyxcbiAgZGVzY3JpcHRpb246ICdUYXNrIHN1bW1hcnkgYnkgYXNzaWduZWUnLFxuICBvYmplY3ROYW1lOiAndGFzaycsXG4gIHR5cGU6ICdzdW1tYXJ5JyxcbiAgY29sdW1uczogW1xuICAgIHsgZmllbGQ6ICdzdWJqZWN0JywgbGFiZWw6ICdTdWJqZWN0JyB9LFxuICAgIHsgZmllbGQ6ICdzdGF0dXMnLCBsYWJlbDogJ1N0YXR1cycgfSxcbiAgICB7IGZpZWxkOiAncHJpb3JpdHknLCBsYWJlbDogJ1ByaW9yaXR5JyB9LFxuICAgIHsgZmllbGQ6ICdkdWVfZGF0ZScsIGxhYmVsOiAnRHVlIERhdGUnIH0sXG4gICAgeyBmaWVsZDogJ2VzdGltYXRlZF9ob3VycycsIGxhYmVsOiAnRXN0LiBIb3VycycsIGFnZ3JlZ2F0ZTogJ3N1bScgfSxcbiAgICB7IGZpZWxkOiAnYWN0dWFsX2hvdXJzJywgbGFiZWw6ICdBY3R1YWwgSG91cnMnLCBhZ2dyZWdhdGU6ICdzdW0nIH0sXG4gIF0sXG4gIGdyb3VwaW5nc0Rvd246IFt7IGZpZWxkOiAnb3duZXInLCBzb3J0T3JkZXI6ICdhc2MnIH1dLFxuICBmaWx0ZXI6IHsgaXNfY29tcGxldGVkOiBmYWxzZSB9LFxufTtcblxuLyoqIE92ZXJkdWUgVGFza3MgUmVwb3J0ICovXG5leHBvcnQgY29uc3QgT3ZlcmR1ZVRhc2tzUmVwb3J0OiBSZXBvcnRJbnB1dCA9IHtcbiAgbmFtZTogJ292ZXJkdWVfdGFza3MnLFxuICBsYWJlbDogJ092ZXJkdWUgVGFza3MnLFxuICBkZXNjcmlwdGlvbjogJ0FsbCBvdmVyZHVlIHRhc2tzIHRoYXQgbmVlZCBhdHRlbnRpb24nLFxuICBvYmplY3ROYW1lOiAndGFzaycsXG4gIHR5cGU6ICd0YWJ1bGFyJyxcbiAgY29sdW1uczogW1xuICAgIHsgZmllbGQ6ICdzdWJqZWN0JywgbGFiZWw6ICdTdWJqZWN0JyB9LFxuICAgIHsgZmllbGQ6ICdkdWVfZGF0ZScsIGxhYmVsOiAnRHVlIERhdGUnIH0sXG4gICAgeyBmaWVsZDogJ3ByaW9yaXR5JywgbGFiZWw6ICdQcmlvcml0eScgfSxcbiAgICB7IGZpZWxkOiAnb3duZXInLCBsYWJlbDogJ0Fzc2lnbmVkIFRvJyB9LFxuICAgIHsgZmllbGQ6ICdjYXRlZ29yeScsIGxhYmVsOiAnQ2F0ZWdvcnknIH0sXG4gIF0sXG4gIGZpbHRlcjogeyBpc19vdmVyZHVlOiB0cnVlLCBpc19jb21wbGV0ZWQ6IGZhbHNlIH0sXG59O1xuXG4vKiogQ29tcGxldGVkIFRhc2tzIFJlcG9ydCAqL1xuZXhwb3J0IGNvbnN0IENvbXBsZXRlZFRhc2tzUmVwb3J0OiBSZXBvcnRJbnB1dCA9IHtcbiAgbmFtZTogJ2NvbXBsZXRlZF90YXNrcycsXG4gIGxhYmVsOiAnQ29tcGxldGVkIFRhc2tzJyxcbiAgZGVzY3JpcHRpb246ICdBbGwgY29tcGxldGVkIHRhc2tzIHdpdGggdGltZSB0cmFja2luZycsXG4gIG9iamVjdE5hbWU6ICd0YXNrJyxcbiAgdHlwZTogJ3N1bW1hcnknLFxuICBjb2x1bW5zOiBbXG4gICAgeyBmaWVsZDogJ3N1YmplY3QnLCBsYWJlbDogJ1N1YmplY3QnIH0sXG4gICAgeyBmaWVsZDogJ2NvbXBsZXRlZF9kYXRlJywgbGFiZWw6ICdDb21wbGV0ZWQgRGF0ZScgfSxcbiAgICB7IGZpZWxkOiAnZXN0aW1hdGVkX2hvdXJzJywgbGFiZWw6ICdFc3QuIEhvdXJzJywgYWdncmVnYXRlOiAnc3VtJyB9LFxuICAgIHsgZmllbGQ6ICdhY3R1YWxfaG91cnMnLCBsYWJlbDogJ0FjdHVhbCBIb3VycycsIGFnZ3JlZ2F0ZTogJ3N1bScgfSxcbiAgXSxcbiAgZ3JvdXBpbmdzRG93bjogW3sgZmllbGQ6ICdjYXRlZ29yeScsIHNvcnRPcmRlcjogJ2FzYycgfV0sXG4gIGZpbHRlcjogeyBpc19jb21wbGV0ZWQ6IHRydWUgfSxcbn07XG5cbi8qKiBUaW1lIFRyYWNraW5nIFJlcG9ydCAqL1xuZXhwb3J0IGNvbnN0IFRpbWVUcmFja2luZ1JlcG9ydDogUmVwb3J0SW5wdXQgPSB7XG4gIG5hbWU6ICd0aW1lX3RyYWNraW5nJyxcbiAgbGFiZWw6ICdUaW1lIFRyYWNraW5nIFJlcG9ydCcsXG4gIGRlc2NyaXB0aW9uOiAnRXN0aW1hdGVkIHZzIGFjdHVhbCBob3VycyBhbmFseXNpcycsXG4gIG9iamVjdE5hbWU6ICd0YXNrJyxcbiAgdHlwZTogJ21hdHJpeCcsXG4gIGNvbHVtbnM6IFtcbiAgICB7IGZpZWxkOiAnZXN0aW1hdGVkX2hvdXJzJywgbGFiZWw6ICdFc3RpbWF0ZWQgSG91cnMnLCBhZ2dyZWdhdGU6ICdzdW0nIH0sXG4gICAgeyBmaWVsZDogJ2FjdHVhbF9ob3VycycsIGxhYmVsOiAnQWN0dWFsIEhvdXJzJywgYWdncmVnYXRlOiAnc3VtJyB9LFxuICBdLFxuICBncm91cGluZ3NEb3duOiBbeyBmaWVsZDogJ293bmVyJywgc29ydE9yZGVyOiAnYXNjJyB9XSxcbiAgZ3JvdXBpbmdzQWNyb3NzOiBbeyBmaWVsZDogJ2NhdGVnb3J5Jywgc29ydE9yZGVyOiAnYXNjJyB9XSxcbiAgZmlsdGVyOiB7IGlzX2NvbXBsZXRlZDogdHJ1ZSB9LFxufTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC10b2RvL3NyYy9mbG93cy9pbmRleC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtdG9kby9zcmMvZmxvd3NcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLXRvZG8vc3JjL2Zsb3dzL2luZGV4LnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG4vKipcbiAqIEZsb3cgRGVmaW5pdGlvbnMgQmFycmVsXG4gKi9cbmV4cG9ydCB7XG4gIFRhc2tSZW1pbmRlckZsb3csXG4gIE92ZXJkdWVFc2NhbGF0aW9uRmxvdyxcbiAgVGFza0NvbXBsZXRpb25GbG93LFxuICBRdWlja0FkZFRhc2tGbG93LFxufSBmcm9tICcuL3Rhc2suZmxvdyc7XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtdG9kby9zcmMvZmxvd3MvdGFzay5mbG93LnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC10b2RvL3NyYy9mbG93c1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtdG9kby9zcmMvZmxvd3MvdGFzay5mbG93LnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5pbXBvcnQgdHlwZSB7IEF1dG9tYXRpb24gfSBmcm9tICdAb2JqZWN0c3RhY2svc3BlYyc7XG50eXBlIEZsb3cgPSBBdXRvbWF0aW9uLkZsb3c7XG5cbi8qKiBUYXNrIFJlbWluZGVyIEZsb3cgXHUyMDE0IHNjaGVkdWxlZCBmbG93IHRvIHNlbmQgcmVtaW5kZXJzIGZvciB1cGNvbWluZyB0YXNrcyAqL1xuZXhwb3J0IGNvbnN0IFRhc2tSZW1pbmRlckZsb3c6IEZsb3cgPSB7XG4gIG5hbWU6ICd0YXNrX3JlbWluZGVyJyxcbiAgbGFiZWw6ICdUYXNrIFJlbWluZGVyIE5vdGlmaWNhdGlvbicsXG4gIGRlc2NyaXB0aW9uOiAnQXV0b21hdGVkIGZsb3cgdG8gc2VuZCByZW1pbmRlcnMgZm9yIHRhc2tzIGFwcHJvYWNoaW5nIHRoZWlyIGR1ZSBkYXRlJyxcbiAgdHlwZTogJ3NjaGVkdWxlJyxcblxuICB2YXJpYWJsZXM6IFtcbiAgICB7IG5hbWU6ICd0YXNrc1RvUmVtaW5kJywgdHlwZTogJ3JlY29yZF9jb2xsZWN0aW9uJywgaXNJbnB1dDogZmFsc2UsIGlzT3V0cHV0OiBmYWxzZSB9LFxuICBdLFxuXG4gIG5vZGVzOiBbXG4gICAgeyBpZDogJ3N0YXJ0JywgdHlwZTogJ3N0YXJ0JywgbGFiZWw6ICdTdGFydCAoRGFpbHkgOCBBTSknLCBjb25maWc6IHsgc2NoZWR1bGU6ICcwIDggKiAqIConLCBvYmplY3ROYW1lOiAndGFzaycgfSB9LFxuICAgIHtcbiAgICAgIGlkOiAnZ2V0X3VwY29taW5nX3Rhc2tzJywgdHlwZTogJ2dldF9yZWNvcmQnLCBsYWJlbDogJ0dldCBUYXNrcyBEdWUgVG9tb3Jyb3cnLFxuICAgICAgY29uZmlnOiB7IG9iamVjdE5hbWU6ICd0YXNrJywgZmlsdGVyOiB7IGR1ZV9kYXRlOiAne3RvbW9ycm93fScsIGlzX2NvbXBsZXRlZDogZmFsc2UgfSwgb3V0cHV0VmFyaWFibGU6ICd0YXNrc1RvUmVtaW5kJywgZ2V0QWxsOiB0cnVlIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2xvb3BfdGFza3MnLCB0eXBlOiAnbG9vcCcsIGxhYmVsOiAnTG9vcCBUaHJvdWdoIFRhc2tzJyxcbiAgICAgIGNvbmZpZzogeyBjb2xsZWN0aW9uOiAne3Rhc2tzVG9SZW1pbmR9JywgaXRlcmF0b3JWYXJpYWJsZTogJ2N1cnJlbnRUYXNrJyB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdzZW5kX3JlbWluZGVyJywgdHlwZTogJ3NjcmlwdCcsIGxhYmVsOiAnU2VuZCBSZW1pbmRlciBFbWFpbCcsXG4gICAgICBjb25maWc6IHtcbiAgICAgICAgYWN0aW9uVHlwZTogJ2VtYWlsJyxcbiAgICAgICAgaW5wdXRzOiB7XG4gICAgICAgICAgdG86ICd7Y3VycmVudFRhc2sub3duZXIuZW1haWx9JyxcbiAgICAgICAgICBzdWJqZWN0OiAnVGFzayBEdWUgVG9tb3Jyb3c6IHtjdXJyZW50VGFzay5zdWJqZWN0fScsXG4gICAgICAgICAgdGVtcGxhdGU6ICd0YXNrX3JlbWluZGVyX2VtYWlsJyxcbiAgICAgICAgICBkYXRhOiB7IHRhc2tTdWJqZWN0OiAne2N1cnJlbnRUYXNrLnN1YmplY3R9JywgZHVlRGF0ZTogJ3tjdXJyZW50VGFzay5kdWVfZGF0ZX0nLCBwcmlvcml0eTogJ3tjdXJyZW50VGFzay5wcmlvcml0eX0nIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gICAgeyBpZDogJ2VuZCcsIHR5cGU6ICdlbmQnLCBsYWJlbDogJ0VuZCcgfSxcbiAgXSxcblxuICBlZGdlczogW1xuICAgIHsgaWQ6ICdlMScsIHNvdXJjZTogJ3N0YXJ0JywgdGFyZ2V0OiAnZ2V0X3VwY29taW5nX3Rhc2tzJywgdHlwZTogJ2RlZmF1bHQnIH0sXG4gICAgeyBpZDogJ2UyJywgc291cmNlOiAnZ2V0X3VwY29taW5nX3Rhc2tzJywgdGFyZ2V0OiAnbG9vcF90YXNrcycsIHR5cGU6ICdkZWZhdWx0JyB9LFxuICAgIHsgaWQ6ICdlMycsIHNvdXJjZTogJ2xvb3BfdGFza3MnLCB0YXJnZXQ6ICdzZW5kX3JlbWluZGVyJywgdHlwZTogJ2RlZmF1bHQnIH0sXG4gICAgeyBpZDogJ2U0Jywgc291cmNlOiAnc2VuZF9yZW1pbmRlcicsIHRhcmdldDogJ2VuZCcsIHR5cGU6ICdkZWZhdWx0JyB9LFxuICBdLFxufTtcblxuLyoqIE92ZXJkdWUgVGFzayBFc2NhbGF0aW9uIEZsb3cgKi9cbmV4cG9ydCBjb25zdCBPdmVyZHVlRXNjYWxhdGlvbkZsb3c6IEZsb3cgPSB7XG4gIG5hbWU6ICdvdmVyZHVlX2VzY2FsYXRpb24nLFxuICBsYWJlbDogJ092ZXJkdWUgVGFzayBFc2NhbGF0aW9uJyxcbiAgZGVzY3JpcHRpb246ICdFc2NhbGF0ZXMgdGFza3MgdGhhdCBoYXZlIGJlZW4gb3ZlcmR1ZSBmb3IgbW9yZSB0aGFuIDMgZGF5cycsXG4gIHR5cGU6ICdzY2hlZHVsZScsXG5cbiAgdmFyaWFibGVzOiBbXG4gICAgeyBuYW1lOiAnb3ZlcmR1ZVRhc2tzJywgdHlwZTogJ3JlY29yZF9jb2xsZWN0aW9uJywgaXNJbnB1dDogZmFsc2UsIGlzT3V0cHV0OiBmYWxzZSB9LFxuICBdLFxuXG4gIG5vZGVzOiBbXG4gICAgeyBpZDogJ3N0YXJ0JywgdHlwZTogJ3N0YXJ0JywgbGFiZWw6ICdTdGFydCAoRGFpbHkgOSBBTSknLCBjb25maWc6IHsgc2NoZWR1bGU6ICcwIDkgKiAqIConLCBvYmplY3ROYW1lOiAndGFzaycgfSB9LFxuICAgIHtcbiAgICAgIGlkOiAnZ2V0X292ZXJkdWVfdGFza3MnLCB0eXBlOiAnZ2V0X3JlY29yZCcsIGxhYmVsOiAnR2V0IFNldmVyZWx5IE92ZXJkdWUgVGFza3MnLFxuICAgICAgY29uZmlnOiB7XG4gICAgICAgIG9iamVjdE5hbWU6ICd0YXNrJyxcbiAgICAgICAgZmlsdGVyOiB7IGR1ZV9kYXRlOiB7ICRsdDogJ3szX2RheXNfYWdvfScgfSwgaXNfY29tcGxldGVkOiBmYWxzZSwgaXNfb3ZlcmR1ZTogdHJ1ZSB9LFxuICAgICAgICBvdXRwdXRWYXJpYWJsZTogJ292ZXJkdWVUYXNrcycsIGdldEFsbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2xvb3Bfb3ZlcmR1ZScsIHR5cGU6ICdsb29wJywgbGFiZWw6ICdMb29wIFRocm91Z2ggT3ZlcmR1ZSBUYXNrcycsXG4gICAgICBjb25maWc6IHsgY29sbGVjdGlvbjogJ3tvdmVyZHVlVGFza3N9JywgaXRlcmF0b3JWYXJpYWJsZTogJ2N1cnJlbnRUYXNrJyB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICd1cGRhdGVfcHJpb3JpdHknLCB0eXBlOiAndXBkYXRlX3JlY29yZCcsIGxhYmVsOiAnRXNjYWxhdGUgUHJpb3JpdHknLFxuICAgICAgY29uZmlnOiB7XG4gICAgICAgIG9iamVjdE5hbWU6ICd0YXNrJyxcbiAgICAgICAgZmlsdGVyOiB7IGlkOiAne2N1cnJlbnRUYXNrLmlkfScgfSxcbiAgICAgICAgZmllbGRzOiB7IHByaW9yaXR5OiAndXJnZW50JywgdGFnczogWydpbXBvcnRhbnQnLCAnZm9sbG93X3VwJ10gfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ25vdGlmeV9vd25lcicsIHR5cGU6ICdzY3JpcHQnLCBsYWJlbDogJ05vdGlmeSBUYXNrIE93bmVyJyxcbiAgICAgIGNvbmZpZzoge1xuICAgICAgICBhY3Rpb25UeXBlOiAnZW1haWwnLFxuICAgICAgICBpbnB1dHM6IHtcbiAgICAgICAgICB0bzogJ3tjdXJyZW50VGFzay5vd25lci5lbWFpbH0nLFxuICAgICAgICAgIHN1YmplY3Q6ICdVUkdFTlQ6IFRhc2sgT3ZlcmR1ZSAtIHtjdXJyZW50VGFzay5zdWJqZWN0fScsXG4gICAgICAgICAgdGVtcGxhdGU6ICdvdmVyZHVlX2VzY2FsYXRpb25fZW1haWwnLFxuICAgICAgICAgIGRhdGE6IHsgdGFza1N1YmplY3Q6ICd7Y3VycmVudFRhc2suc3ViamVjdH0nLCBkdWVEYXRlOiAne2N1cnJlbnRUYXNrLmR1ZV9kYXRlfScsIGRheXNPdmVyZHVlOiAne2N1cnJlbnRUYXNrLmRheXNfb3ZlcmR1ZX0nIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gICAgeyBpZDogJ2VuZCcsIHR5cGU6ICdlbmQnLCBsYWJlbDogJ0VuZCcgfSxcbiAgXSxcblxuICBlZGdlczogW1xuICAgIHsgaWQ6ICdlMScsIHNvdXJjZTogJ3N0YXJ0JywgdGFyZ2V0OiAnZ2V0X292ZXJkdWVfdGFza3MnLCB0eXBlOiAnZGVmYXVsdCcgfSxcbiAgICB7IGlkOiAnZTInLCBzb3VyY2U6ICdnZXRfb3ZlcmR1ZV90YXNrcycsIHRhcmdldDogJ2xvb3Bfb3ZlcmR1ZScsIHR5cGU6ICdkZWZhdWx0JyB9LFxuICAgIHsgaWQ6ICdlMycsIHNvdXJjZTogJ2xvb3Bfb3ZlcmR1ZScsIHRhcmdldDogJ3VwZGF0ZV9wcmlvcml0eScsIHR5cGU6ICdkZWZhdWx0JyB9LFxuICAgIHsgaWQ6ICdlNCcsIHNvdXJjZTogJ3VwZGF0ZV9wcmlvcml0eScsIHRhcmdldDogJ25vdGlmeV9vd25lcicsIHR5cGU6ICdkZWZhdWx0JyB9LFxuICAgIHsgaWQ6ICdlNScsIHNvdXJjZTogJ25vdGlmeV9vd25lcicsIHRhcmdldDogJ2VuZCcsIHR5cGU6ICdkZWZhdWx0JyB9LFxuICBdLFxufTtcblxuLyoqIFRhc2sgQ29tcGxldGlvbiBGbG93ICovXG5leHBvcnQgY29uc3QgVGFza0NvbXBsZXRpb25GbG93OiBGbG93ID0ge1xuICBuYW1lOiAndGFza19jb21wbGV0aW9uJyxcbiAgbGFiZWw6ICdUYXNrIENvbXBsZXRpb24gUHJvY2VzcycsXG4gIGRlc2NyaXB0aW9uOiAnRmxvdyB0cmlnZ2VyZWQgd2hlbiBhIHRhc2sgaXMgbWFya2VkIGFzIGNvbXBsZXRlJyxcbiAgdHlwZTogJ3JlY29yZF9jaGFuZ2UnLFxuXG4gIHZhcmlhYmxlczogW1xuICAgIHsgbmFtZTogJ3Rhc2tJZCcsIHR5cGU6ICd0ZXh0JywgaXNJbnB1dDogdHJ1ZSwgaXNPdXRwdXQ6IGZhbHNlIH0sXG4gICAgeyBuYW1lOiAnY29tcGxldGVkVGFzaycsIHR5cGU6ICdyZWNvcmQnLCBpc0lucHV0OiBmYWxzZSwgaXNPdXRwdXQ6IGZhbHNlIH0sXG4gIF0sXG5cbiAgbm9kZXM6IFtcbiAgICB7IGlkOiAnc3RhcnQnLCB0eXBlOiAnc3RhcnQnLCBsYWJlbDogJ1N0YXJ0JywgY29uZmlnOiB7IG9iamVjdE5hbWU6ICd0YXNrJywgdHJpZ2dlckNvbmRpdGlvbjogJ0lTQ0hBTkdFRChzdGF0dXMpIEFORCBzdGF0dXMgPSBcImNvbXBsZXRlZFwiJyB9IH0sXG4gICAge1xuICAgICAgaWQ6ICdnZXRfdGFzaycsIHR5cGU6ICdnZXRfcmVjb3JkJywgbGFiZWw6ICdHZXQgQ29tcGxldGVkIFRhc2snLFxuICAgICAgY29uZmlnOiB7IG9iamVjdE5hbWU6ICd0YXNrJywgZmlsdGVyOiB7IGlkOiAne3Rhc2tJZH0nIH0sIG91dHB1dFZhcmlhYmxlOiAnY29tcGxldGVkVGFzaycgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnY2hlY2tfcmVjdXJyaW5nJywgdHlwZTogJ2RlY2lzaW9uJywgbGFiZWw6ICdJcyBSZWN1cnJpbmcgVGFzaz8nLFxuICAgICAgY29uZmlnOiB7IGNvbmRpdGlvbjogJ3tjb21wbGV0ZWRUYXNrLmlzX3JlY3VycmluZ30gPT0gdHJ1ZScgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnY3JlYXRlX25leHRfdGFzaycsIHR5cGU6ICdjcmVhdGVfcmVjb3JkJywgbGFiZWw6ICdDcmVhdGUgTmV4dCBSZWN1cnJpbmcgVGFzaycsXG4gICAgICBjb25maWc6IHtcbiAgICAgICAgb2JqZWN0TmFtZTogJ3Rhc2snLFxuICAgICAgICBmaWVsZHM6IHtcbiAgICAgICAgICBzdWJqZWN0OiAne2NvbXBsZXRlZFRhc2suc3ViamVjdH0nLCBkZXNjcmlwdGlvbjogJ3tjb21wbGV0ZWRUYXNrLmRlc2NyaXB0aW9ufScsXG4gICAgICAgICAgcHJpb3JpdHk6ICd7Y29tcGxldGVkVGFzay5wcmlvcml0eX0nLCBjYXRlZ29yeTogJ3tjb21wbGV0ZWRUYXNrLmNhdGVnb3J5fScsXG4gICAgICAgICAgb3duZXI6ICd7Y29tcGxldGVkVGFzay5vd25lcn0nLCBpc19yZWN1cnJpbmc6IHRydWUsXG4gICAgICAgICAgcmVjdXJyZW5jZV90eXBlOiAne2NvbXBsZXRlZFRhc2sucmVjdXJyZW5jZV90eXBlfScsXG4gICAgICAgICAgcmVjdXJyZW5jZV9pbnRlcnZhbDogJ3tjb21wbGV0ZWRUYXNrLnJlY3VycmVuY2VfaW50ZXJ2YWx9JyxcbiAgICAgICAgICBkdWVfZGF0ZTogJ0RBVEVBREQoe2NvbXBsZXRlZFRhc2suZHVlX2RhdGV9LCB7Y29tcGxldGVkVGFzay5yZWN1cnJlbmNlX2ludGVydmFsfSwgXCJ7Y29tcGxldGVkVGFzay5yZWN1cnJlbmNlX3R5cGV9XCIpJyxcbiAgICAgICAgICBzdGF0dXM6ICdub3Rfc3RhcnRlZCcsIGlzX2NvbXBsZXRlZDogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICAgIG91dHB1dFZhcmlhYmxlOiAnbmV3VGFza0lkJyxcbiAgICAgIH0sXG4gICAgfSxcbiAgICB7IGlkOiAnZW5kJywgdHlwZTogJ2VuZCcsIGxhYmVsOiAnRW5kJyB9LFxuICBdLFxuXG4gIGVkZ2VzOiBbXG4gICAgeyBpZDogJ2UxJywgc291cmNlOiAnc3RhcnQnLCB0YXJnZXQ6ICdnZXRfdGFzaycsIHR5cGU6ICdkZWZhdWx0JyB9LFxuICAgIHsgaWQ6ICdlMicsIHNvdXJjZTogJ2dldF90YXNrJywgdGFyZ2V0OiAnY2hlY2tfcmVjdXJyaW5nJywgdHlwZTogJ2RlZmF1bHQnIH0sXG4gICAgeyBpZDogJ2UzJywgc291cmNlOiAnY2hlY2tfcmVjdXJyaW5nJywgdGFyZ2V0OiAnY3JlYXRlX25leHRfdGFzaycsIHR5cGU6ICdkZWZhdWx0JywgY29uZGl0aW9uOiAne2NvbXBsZXRlZFRhc2suaXNfcmVjdXJyaW5nfSA9PSB0cnVlJywgbGFiZWw6ICdZZXMnIH0sXG4gICAgeyBpZDogJ2U0Jywgc291cmNlOiAnY2hlY2tfcmVjdXJyaW5nJywgdGFyZ2V0OiAnZW5kJywgdHlwZTogJ2RlZmF1bHQnLCBjb25kaXRpb246ICd7Y29tcGxldGVkVGFzay5pc19yZWN1cnJpbmd9ICE9IHRydWUnLCBsYWJlbDogJ05vJyB9LFxuICAgIHsgaWQ6ICdlNScsIHNvdXJjZTogJ2NyZWF0ZV9uZXh0X3Rhc2snLCB0YXJnZXQ6ICdlbmQnLCB0eXBlOiAnZGVmYXVsdCcgfSxcbiAgXSxcbn07XG5cbi8qKiBRdWljayBBZGQgVGFzayBGbG93IFx1MjAxNCBzY3JlZW4gZmxvdyBmb3IgcXVpY2tseSBhZGRpbmcgdGFza3MgKi9cbmV4cG9ydCBjb25zdCBRdWlja0FkZFRhc2tGbG93OiBGbG93ID0ge1xuICBuYW1lOiAncXVpY2tfYWRkX3Rhc2snLFxuICBsYWJlbDogJ1F1aWNrIEFkZCBUYXNrJyxcbiAgZGVzY3JpcHRpb246ICdTY3JlZW4gZmxvdyBmb3IgcXVpY2tseSBjcmVhdGluZyBhIG5ldyB0YXNrJyxcbiAgdHlwZTogJ3NjcmVlbicsXG5cbiAgdmFyaWFibGVzOiBbXG4gICAgeyBuYW1lOiAnc3ViamVjdCcsIHR5cGU6ICd0ZXh0JywgaXNJbnB1dDogdHJ1ZSwgaXNPdXRwdXQ6IGZhbHNlIH0sXG4gICAgeyBuYW1lOiAncHJpb3JpdHknLCB0eXBlOiAndGV4dCcsIGlzSW5wdXQ6IHRydWUsIGlzT3V0cHV0OiBmYWxzZSB9LFxuICAgIHsgbmFtZTogJ2R1ZURhdGUnLCB0eXBlOiAnZGF0ZScsIGlzSW5wdXQ6IHRydWUsIGlzT3V0cHV0OiBmYWxzZSB9LFxuICAgIHsgbmFtZTogJ25ld1Rhc2tJZCcsIHR5cGU6ICd0ZXh0JywgaXNJbnB1dDogZmFsc2UsIGlzT3V0cHV0OiB0cnVlIH0sXG4gIF0sXG5cbiAgbm9kZXM6IFtcbiAgICB7IGlkOiAnc3RhcnQnLCB0eXBlOiAnc3RhcnQnLCBsYWJlbDogJ1N0YXJ0JyB9LFxuICAgIHtcbiAgICAgIGlkOiAnc2NyZWVuXzEnLCB0eXBlOiAnc2NyZWVuJywgbGFiZWw6ICdUYXNrIERldGFpbHMnLFxuICAgICAgY29uZmlnOiB7XG4gICAgICAgIGZpZWxkczogW1xuICAgICAgICAgIHsgbmFtZTogJ3N1YmplY3QnLCBsYWJlbDogJ1Rhc2sgU3ViamVjdCcsIHR5cGU6ICd0ZXh0JywgcmVxdWlyZWQ6IHRydWUgfSxcbiAgICAgICAgICB7IG5hbWU6ICdwcmlvcml0eScsIGxhYmVsOiAnUHJpb3JpdHknLCB0eXBlOiAnc2VsZWN0Jywgb3B0aW9uczogWydsb3cnLCAnbm9ybWFsJywgJ2hpZ2gnLCAndXJnZW50J10sIGRlZmF1bHRWYWx1ZTogJ25vcm1hbCcgfSxcbiAgICAgICAgICB7IG5hbWU6ICdkdWVEYXRlJywgbGFiZWw6ICdEdWUgRGF0ZScsIHR5cGU6ICdkYXRlJywgcmVxdWlyZWQ6IGZhbHNlIH0sXG4gICAgICAgICAgeyBuYW1lOiAnY2F0ZWdvcnknLCBsYWJlbDogJ0NhdGVnb3J5JywgdHlwZTogJ3NlbGVjdCcsIG9wdGlvbnM6IFsnUGVyc29uYWwnLCAnV29yaycsICdTaG9wcGluZycsICdIZWFsdGgnLCAnRmluYW5jZScsICdPdGhlciddIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdjcmVhdGVfdGFzaycsIHR5cGU6ICdjcmVhdGVfcmVjb3JkJywgbGFiZWw6ICdDcmVhdGUgVGFzaycsXG4gICAgICBjb25maWc6IHtcbiAgICAgICAgb2JqZWN0TmFtZTogJ3Rhc2snLFxuICAgICAgICBmaWVsZHM6IHsgc3ViamVjdDogJ3tzdWJqZWN0fScsIHByaW9yaXR5OiAne3ByaW9yaXR5fScsIGR1ZV9kYXRlOiAne2R1ZURhdGV9JywgY2F0ZWdvcnk6ICd7Y2F0ZWdvcnl9Jywgc3RhdHVzOiAnbm90X3N0YXJ0ZWQnLCBvd25lcjogJ3skVXNlci5JZH0nIH0sXG4gICAgICAgIG91dHB1dFZhcmlhYmxlOiAnbmV3VGFza0lkJyxcbiAgICAgIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ3N1Y2Nlc3Nfc2NyZWVuJywgdHlwZTogJ3NjcmVlbicsIGxhYmVsOiAnU3VjY2VzcycsXG4gICAgICBjb25maWc6IHtcbiAgICAgICAgbWVzc2FnZTogJ1Rhc2sgXCJ7c3ViamVjdH1cIiBjcmVhdGVkIHN1Y2Nlc3NmdWxseSEnLFxuICAgICAgICBidXR0b25zOiBbXG4gICAgICAgICAgeyBsYWJlbDogJ0NyZWF0ZSBBbm90aGVyJywgYWN0aW9uOiAncmVzdGFydCcgfSxcbiAgICAgICAgICB7IGxhYmVsOiAnVmlldyBUYXNrJywgYWN0aW9uOiAnbmF2aWdhdGUnLCB0YXJnZXQ6ICcvdGFzay97bmV3VGFza0lkfScgfSxcbiAgICAgICAgICB7IGxhYmVsOiAnRG9uZScsIGFjdGlvbjogJ2ZpbmlzaCcgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICB7IGlkOiAnZW5kJywgdHlwZTogJ2VuZCcsIGxhYmVsOiAnRW5kJyB9LFxuICBdLFxuXG4gIGVkZ2VzOiBbXG4gICAgeyBpZDogJ2UxJywgc291cmNlOiAnc3RhcnQnLCB0YXJnZXQ6ICdzY3JlZW5fMScsIHR5cGU6ICdkZWZhdWx0JyB9LFxuICAgIHsgaWQ6ICdlMicsIHNvdXJjZTogJ3NjcmVlbl8xJywgdGFyZ2V0OiAnY3JlYXRlX3Rhc2snLCB0eXBlOiAnZGVmYXVsdCcgfSxcbiAgICB7IGlkOiAnZTMnLCBzb3VyY2U6ICdjcmVhdGVfdGFzaycsIHRhcmdldDogJ3N1Y2Nlc3Nfc2NyZWVuJywgdHlwZTogJ2RlZmF1bHQnIH0sXG4gICAgeyBpZDogJ2U0Jywgc291cmNlOiAnc3VjY2Vzc19zY3JlZW4nLCB0YXJnZXQ6ICdlbmQnLCB0eXBlOiAnZGVmYXVsdCcgfSxcbiAgXSxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtdG9kby9zcmMvYXBwcy9pbmRleC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtdG9kby9zcmMvYXBwc1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtdG9kby9zcmMvYXBwcy9pbmRleC50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuLyoqXG4gKiBBcHAgRGVmaW5pdGlvbnMgQmFycmVsXG4gKi9cbmV4cG9ydCB7IFRvZG9BcHAgfSBmcm9tICcuL3RvZG8uYXBwJztcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC10b2RvL3NyYy9hcHBzL3RvZG8uYXBwLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC10b2RvL3NyYy9hcHBzXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC10b2RvL3NyYy9hcHBzL3RvZG8uYXBwLnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5pbXBvcnQgeyBBcHAgfSBmcm9tICdAb2JqZWN0c3RhY2svc3BlYy91aSc7XG5cbmV4cG9ydCBjb25zdCBUb2RvQXBwID0gQXBwLmNyZWF0ZSh7XG4gIG5hbWU6ICd0b2RvX2FwcCcsXG4gIGxhYmVsOiAnVG9kbyBNYW5hZ2VyJyxcbiAgaWNvbjogJ2NoZWNrLXNxdWFyZScsXG4gIGJyYW5kaW5nOiB7XG4gICAgcHJpbWFyeUNvbG9yOiAnIzEwQjk4MScsXG4gICAgc2Vjb25kYXJ5Q29sb3I6ICcjM0I4MkY2JyxcbiAgICBsb2dvOiAnL2Fzc2V0cy90b2RvLWxvZ28ucG5nJyxcbiAgICBmYXZpY29uOiAnL2Fzc2V0cy90b2RvLWZhdmljb24uaWNvJyxcbiAgfSxcbiAgXG4gIG5hdmlnYXRpb246IFtcbiAgICB7XG4gICAgICBpZDogJ2dyb3VwX3Rhc2tzJyxcbiAgICAgIHR5cGU6ICdncm91cCcsXG4gICAgICBsYWJlbDogJ1Rhc2tzJyxcbiAgICAgIGljb246ICdjaGVjay1zcXVhcmUnLFxuICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgeyBpZDogJ25hdl9hbGxfdGFza3MnLCB0eXBlOiAnb2JqZWN0Jywgb2JqZWN0TmFtZTogJ3Rhc2snLCBsYWJlbDogJ0FsbCBUYXNrcycsIGljb246ICdsaXN0JyB9LFxuICAgICAgICB7IGlkOiAnbmF2X215X3Rhc2tzJywgdHlwZTogJ29iamVjdCcsIG9iamVjdE5hbWU6ICd0YXNrJywgbGFiZWw6ICdNeSBUYXNrcycsIGljb246ICd1c2VyLWNoZWNrJyB9LFxuICAgICAgICB7IGlkOiAnbmF2X292ZXJkdWUnLCB0eXBlOiAnb2JqZWN0Jywgb2JqZWN0TmFtZTogJ3Rhc2snLCBsYWJlbDogJ092ZXJkdWUnLCBpY29uOiAnYWxlcnQtY2lyY2xlJyB9LFxuICAgICAgICB7IGlkOiAnbmF2X3RvZGF5JywgdHlwZTogJ29iamVjdCcsIG9iamVjdE5hbWU6ICd0YXNrJywgbGFiZWw6ICdEdWUgVG9kYXknLCBpY29uOiAnY2FsZW5kYXInIH0sXG4gICAgICAgIHsgaWQ6ICduYXZfdXBjb21pbmcnLCB0eXBlOiAnb2JqZWN0Jywgb2JqZWN0TmFtZTogJ3Rhc2snLCBsYWJlbDogJ1VwY29taW5nJywgaWNvbjogJ2NhbGVuZGFyLXBsdXMnIH0sXG4gICAgICBdXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2dyb3VwX2FuYWx5dGljcycsXG4gICAgICB0eXBlOiAnZ3JvdXAnLFxuICAgICAgbGFiZWw6ICdBbmFseXRpY3MnLFxuICAgICAgaWNvbjogJ2NoYXJ0LWJhcicsXG4gICAgICBjaGlsZHJlbjogW1xuICAgICAgICB7IGlkOiAnbmF2X2Rhc2hib2FyZCcsIHR5cGU6ICdkYXNoYm9hcmQnLCBkYXNoYm9hcmROYW1lOiAndGFza19kYXNoYm9hcmQnLCBsYWJlbDogJ0Rhc2hib2FyZCcsIGljb246ICdsYXlvdXQtZGFzaGJvYXJkJyB9LFxuICAgICAgXVxuICAgIH0sXG4gIF1cbn0pO1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLXRvZG8vc3JjL3RyYW5zbGF0aW9ucy9pbmRleC50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtdG9kby9zcmMvdHJhbnNsYXRpb25zXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC10b2RvL3NyYy90cmFuc2xhdGlvbnMvaW5kZXgudHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbi8qKlxuICogVHJhbnNsYXRpb24gRGVmaW5pdGlvbnMgQmFycmVsXG4gKi9cbmV4cG9ydCB7IFRvZG9UcmFuc2xhdGlvbnMgfSBmcm9tICcuL3RvZG8udHJhbnNsYXRpb24nO1xuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLXRvZG8vc3JjL3RyYW5zbGF0aW9ucy9lbi50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtdG9kby9zcmMvdHJhbnNsYXRpb25zXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC10b2RvL3NyYy90cmFuc2xhdGlvbnMvZW4udHNcIjsvLyBDb3B5cmlnaHQgKGMpIDIwMjUgT2JqZWN0U3RhY2suIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUtMi4wIGxpY2Vuc2UuXG5cbmltcG9ydCB0eXBlIHsgVHJhbnNsYXRpb25EYXRhIH0gZnJvbSAnQG9iamVjdHN0YWNrL3NwZWMvc3lzdGVtJztcblxuLyoqXG4gKiBFbmdsaXNoIChlbikgXHUyMDE0IFRvZG8gQXBwIFRyYW5zbGF0aW9uc1xuICpcbiAqIFBlci1sb2NhbGUgZmlsZTogb25lIGZpbGUgcGVyIGxhbmd1YWdlLCBmb2xsb3dpbmcgdGhlIGBwZXJfbG9jYWxlYCBjb252ZW50aW9uLlxuICogRWFjaCBmaWxlIGV4cG9ydHMgYSBzaW5nbGUgYFRyYW5zbGF0aW9uRGF0YWAgb2JqZWN0IGZvciBpdHMgbG9jYWxlLlxuICovXG5leHBvcnQgY29uc3QgZW46IFRyYW5zbGF0aW9uRGF0YSA9IHtcbiAgb2JqZWN0czoge1xuICAgIHRhc2s6IHtcbiAgICAgIGxhYmVsOiAnVGFzaycsXG4gICAgICBwbHVyYWxMYWJlbDogJ1Rhc2tzJyxcbiAgICAgIGZpZWxkczoge1xuICAgICAgICBzdWJqZWN0OiB7IGxhYmVsOiAnU3ViamVjdCcsIGhlbHA6ICdCcmllZiB0aXRsZSBvZiB0aGUgdGFzaycgfSxcbiAgICAgICAgZGVzY3JpcHRpb246IHsgbGFiZWw6ICdEZXNjcmlwdGlvbicgfSxcbiAgICAgICAgc3RhdHVzOiB7XG4gICAgICAgICAgbGFiZWw6ICdTdGF0dXMnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIG5vdF9zdGFydGVkOiAnTm90IFN0YXJ0ZWQnLFxuICAgICAgICAgICAgaW5fcHJvZ3Jlc3M6ICdJbiBQcm9ncmVzcycsXG4gICAgICAgICAgICB3YWl0aW5nOiAnV2FpdGluZycsXG4gICAgICAgICAgICBjb21wbGV0ZWQ6ICdDb21wbGV0ZWQnLFxuICAgICAgICAgICAgZGVmZXJyZWQ6ICdEZWZlcnJlZCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgcHJpb3JpdHk6IHtcbiAgICAgICAgICBsYWJlbDogJ1ByaW9yaXR5JyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBsb3c6ICdMb3cnLFxuICAgICAgICAgICAgbm9ybWFsOiAnTm9ybWFsJyxcbiAgICAgICAgICAgIGhpZ2g6ICdIaWdoJyxcbiAgICAgICAgICAgIHVyZ2VudDogJ1VyZ2VudCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgY2F0ZWdvcnk6IHtcbiAgICAgICAgICBsYWJlbDogJ0NhdGVnb3J5JyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBwZXJzb25hbDogJ1BlcnNvbmFsJyxcbiAgICAgICAgICAgIHdvcms6ICdXb3JrJyxcbiAgICAgICAgICAgIHNob3BwaW5nOiAnU2hvcHBpbmcnLFxuICAgICAgICAgICAgaGVhbHRoOiAnSGVhbHRoJyxcbiAgICAgICAgICAgIGZpbmFuY2U6ICdGaW5hbmNlJyxcbiAgICAgICAgICAgIG90aGVyOiAnT3RoZXInLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGR1ZV9kYXRlOiB7IGxhYmVsOiAnRHVlIERhdGUnIH0sXG4gICAgICAgIHJlbWluZGVyX2RhdGU6IHsgbGFiZWw6ICdSZW1pbmRlciBEYXRlL1RpbWUnIH0sXG4gICAgICAgIGNvbXBsZXRlZF9kYXRlOiB7IGxhYmVsOiAnQ29tcGxldGVkIERhdGUnIH0sXG4gICAgICAgIG93bmVyOiB7IGxhYmVsOiAnQXNzaWduZWQgVG8nIH0sXG4gICAgICAgIHRhZ3M6IHtcbiAgICAgICAgICBsYWJlbDogJ1RhZ3MnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIGltcG9ydGFudDogJ0ltcG9ydGFudCcsXG4gICAgICAgICAgICBxdWlja193aW46ICdRdWljayBXaW4nLFxuICAgICAgICAgICAgYmxvY2tlZDogJ0Jsb2NrZWQnLFxuICAgICAgICAgICAgZm9sbG93X3VwOiAnRm9sbG93IFVwJyxcbiAgICAgICAgICAgIHJldmlldzogJ1JldmlldycsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgaXNfcmVjdXJyaW5nOiB7IGxhYmVsOiAnUmVjdXJyaW5nIFRhc2snIH0sXG4gICAgICAgIHJlY3VycmVuY2VfdHlwZToge1xuICAgICAgICAgIGxhYmVsOiAnUmVjdXJyZW5jZSBUeXBlJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBkYWlseTogJ0RhaWx5JyxcbiAgICAgICAgICAgIHdlZWtseTogJ1dlZWtseScsXG4gICAgICAgICAgICBtb250aGx5OiAnTW9udGhseScsXG4gICAgICAgICAgICB5ZWFybHk6ICdZZWFybHknLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHJlY3VycmVuY2VfaW50ZXJ2YWw6IHsgbGFiZWw6ICdSZWN1cnJlbmNlIEludGVydmFsJyB9LFxuICAgICAgICBpc19jb21wbGV0ZWQ6IHsgbGFiZWw6ICdJcyBDb21wbGV0ZWQnIH0sXG4gICAgICAgIGlzX292ZXJkdWU6IHsgbGFiZWw6ICdJcyBPdmVyZHVlJyB9LFxuICAgICAgICBwcm9ncmVzc19wZXJjZW50OiB7IGxhYmVsOiAnUHJvZ3Jlc3MgKCUpJyB9LFxuICAgICAgICBlc3RpbWF0ZWRfaG91cnM6IHsgbGFiZWw6ICdFc3RpbWF0ZWQgSG91cnMnIH0sXG4gICAgICAgIGFjdHVhbF9ob3VyczogeyBsYWJlbDogJ0FjdHVhbCBIb3VycycgfSxcbiAgICAgICAgbm90ZXM6IHsgbGFiZWw6ICdOb3RlcycgfSxcbiAgICAgICAgY2F0ZWdvcnlfY29sb3I6IHsgbGFiZWw6ICdDYXRlZ29yeSBDb2xvcicgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgYXBwczoge1xuICAgIHRvZG9fYXBwOiB7XG4gICAgICBsYWJlbDogJ1RvZG8gTWFuYWdlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ1BlcnNvbmFsIHRhc2sgbWFuYWdlbWVudCBhcHBsaWNhdGlvbicsXG4gICAgfSxcbiAgfSxcbiAgbWVzc2FnZXM6IHtcbiAgICAnY29tbW9uLnNhdmUnOiAnU2F2ZScsXG4gICAgJ2NvbW1vbi5jYW5jZWwnOiAnQ2FuY2VsJyxcbiAgICAnY29tbW9uLmRlbGV0ZSc6ICdEZWxldGUnLFxuICAgICdjb21tb24uZWRpdCc6ICdFZGl0JyxcbiAgICAnY29tbW9uLmNyZWF0ZSc6ICdDcmVhdGUnLFxuICAgICdjb21tb24uc2VhcmNoJzogJ1NlYXJjaCcsXG4gICAgJ2NvbW1vbi5maWx0ZXInOiAnRmlsdGVyJyxcbiAgICAnY29tbW9uLnNvcnQnOiAnU29ydCcsXG4gICAgJ2NvbW1vbi5yZWZyZXNoJzogJ1JlZnJlc2gnLFxuICAgICdjb21tb24uZXhwb3J0JzogJ0V4cG9ydCcsXG4gICAgJ2NvbW1vbi5iYWNrJzogJ0JhY2snLFxuICAgICdjb21tb24uY29uZmlybSc6ICdDb25maXJtJyxcbiAgICAnc3VjY2Vzcy5zYXZlZCc6ICdTdWNjZXNzZnVsbHkgc2F2ZWQnLFxuICAgICdzdWNjZXNzLmRlbGV0ZWQnOiAnU3VjY2Vzc2Z1bGx5IGRlbGV0ZWQnLFxuICAgICdzdWNjZXNzLmNvbXBsZXRlZCc6ICdUYXNrIG1hcmtlZCBhcyBjb21wbGV0ZWQnLFxuICAgICdjb25maXJtLmRlbGV0ZSc6ICdBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gZGVsZXRlIHRoaXMgdGFzaz8nLFxuICAgICdjb25maXJtLmNvbXBsZXRlJzogJ01hcmsgdGhpcyB0YXNrIGFzIGNvbXBsZXRlZD8nLFxuICAgICdlcnJvci5yZXF1aXJlZCc6ICdUaGlzIGZpZWxkIGlzIHJlcXVpcmVkJyxcbiAgICAnZXJyb3IubG9hZF9mYWlsZWQnOiAnRmFpbGVkIHRvIGxvYWQgZGF0YScsXG4gIH0sXG4gIHZhbGlkYXRpb25NZXNzYWdlczoge1xuICAgIGNvbXBsZXRlZF9kYXRlX3JlcXVpcmVkOiAnQ29tcGxldGVkIGRhdGUgaXMgcmVxdWlyZWQgd2hlbiBzdGF0dXMgaXMgQ29tcGxldGVkJyxcbiAgICByZWN1cnJlbmNlX2ZpZWxkc19yZXF1aXJlZDogJ1JlY3VycmVuY2UgdHlwZSBpcyByZXF1aXJlZCBmb3IgcmVjdXJyaW5nIHRhc2tzJyxcbiAgfSxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtdG9kby9zcmMvdHJhbnNsYXRpb25zL3poLUNOLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC10b2RvL3NyYy90cmFuc2xhdGlvbnNcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLXRvZG8vc3JjL3RyYW5zbGF0aW9ucy96aC1DTi50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuaW1wb3J0IHR5cGUgeyBUcmFuc2xhdGlvbkRhdGEgfSBmcm9tICdAb2JqZWN0c3RhY2svc3BlYy9zeXN0ZW0nO1xuaW1wb3J0IHR5cGUgeyBTdHJpY3RPYmplY3RUcmFuc2xhdGlvbiB9IGZyb20gJ0BvYmplY3RzdGFjay9zcGVjL3N5c3RlbSc7XG5pbXBvcnQgeyBUYXNrIH0gZnJvbSAnLi4vb2JqZWN0cy90YXNrLm9iamVjdCc7XG5cbnR5cGUgVGFza1RyYW5zbGF0aW9uID0gU3RyaWN0T2JqZWN0VHJhbnNsYXRpb248dHlwZW9mIFRhc2s+O1xuXG4vKipcbiAqIFx1N0I4MFx1NEY1M1x1NEUyRFx1NjU4NyAoemgtQ04pIFx1MjAxNCBUb2RvIEFwcCBUcmFuc2xhdGlvbnNcbiAqXG4gKiBQZXItbG9jYWxlIGZpbGU6IG9uZSBmaWxlIHBlciBsYW5ndWFnZSwgZm9sbG93aW5nIHRoZSBgcGVyX2xvY2FsZWAgY29udmVudGlvbi5cbiAqL1xuZXhwb3J0IGNvbnN0IHpoQ046IFRyYW5zbGF0aW9uRGF0YSA9IHtcbiAgb2JqZWN0czoge1xuICAgIHRhc2s6IHtcbiAgICAgIGxhYmVsOiAnXHU0RUZCXHU1MkExJyxcbiAgICAgIHBsdXJhbExhYmVsOiAnXHU0RUZCXHU1MkExJyxcbiAgICAgIGZpZWxkczoge1xuICAgICAgICBzdWJqZWN0OiB7IGxhYmVsOiAnXHU0RTNCXHU5ODk4JywgaGVscDogJ1x1NEVGQlx1NTJBMVx1NzY4NFx1N0I4MFx1ODk4MVx1NjgwN1x1OTg5OCcgfSxcbiAgICAgICAgZGVzY3JpcHRpb246IHsgbGFiZWw6ICdcdTYzQ0ZcdThGRjAnIH0sXG4gICAgICAgIHN0YXR1czoge1xuICAgICAgICAgIGxhYmVsOiAnXHU3MkI2XHU2MDAxJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBub3Rfc3RhcnRlZDogJ1x1NjcyQVx1NUYwMFx1NTlDQicsXG4gICAgICAgICAgICBpbl9wcm9ncmVzczogJ1x1OEZEQlx1ODg0Q1x1NEUyRCcsXG4gICAgICAgICAgICB3YWl0aW5nOiAnXHU3QjQ5XHU1Rjg1XHU0RTJEJyxcbiAgICAgICAgICAgIGNvbXBsZXRlZDogJ1x1NURGMlx1NUI4Q1x1NjIxMCcsXG4gICAgICAgICAgICBkZWZlcnJlZDogJ1x1NURGMlx1NjNBOFx1OEZERicsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgcHJpb3JpdHk6IHtcbiAgICAgICAgICBsYWJlbDogJ1x1NEYxOFx1NTE0OFx1N0VBNycsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgbG93OiAnXHU0RjRFJyxcbiAgICAgICAgICAgIG5vcm1hbDogJ1x1NjY2RVx1OTAxQScsXG4gICAgICAgICAgICBoaWdoOiAnXHU5QUQ4JyxcbiAgICAgICAgICAgIHVyZ2VudDogJ1x1N0QyN1x1NjAyNScsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgY2F0ZWdvcnk6IHtcbiAgICAgICAgICBsYWJlbDogJ1x1NTIwNlx1N0M3QicsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgcGVyc29uYWw6ICdcdTRFMkFcdTRFQkEnLFxuICAgICAgICAgICAgd29yazogJ1x1NURFNVx1NEY1QycsXG4gICAgICAgICAgICBzaG9wcGluZzogJ1x1OEQyRFx1NzI2OScsXG4gICAgICAgICAgICBoZWFsdGg6ICdcdTUwNjVcdTVFQjcnLFxuICAgICAgICAgICAgZmluYW5jZTogJ1x1OEQyMlx1NTJBMScsXG4gICAgICAgICAgICBvdGhlcjogJ1x1NTE3Nlx1NEVENicsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgZHVlX2RhdGU6IHsgbGFiZWw6ICdcdTYyMkFcdTZCNjJcdTY1RTVcdTY3MUYnIH0sXG4gICAgICAgIHJlbWluZGVyX2RhdGU6IHsgbGFiZWw6ICdcdTYzRDBcdTkxOTJcdTY1RTVcdTY3MUYvXHU2NUY2XHU5NUY0JyB9LFxuICAgICAgICBjb21wbGV0ZWRfZGF0ZTogeyBsYWJlbDogJ1x1NUI4Q1x1NjIxMFx1NjVFNVx1NjcxRicgfSxcbiAgICAgICAgb3duZXI6IHsgbGFiZWw6ICdcdThEMUZcdThEMjNcdTRFQkEnIH0sXG4gICAgICAgIHRhZ3M6IHtcbiAgICAgICAgICBsYWJlbDogJ1x1NjgwN1x1N0I3RScsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgaW1wb3J0YW50OiAnXHU5MUNEXHU4OTgxJyxcbiAgICAgICAgICAgIHF1aWNrX3dpbjogJ1x1OTAxRlx1ODBEQycsXG4gICAgICAgICAgICBibG9ja2VkOiAnXHU1M0Q3XHU5NjNCJyxcbiAgICAgICAgICAgIGZvbGxvd191cDogJ1x1NUY4NVx1OERERlx1OEZEQicsXG4gICAgICAgICAgICByZXZpZXc6ICdcdTVGODVcdTVCQTFcdTY4MzgnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGlzX3JlY3VycmluZzogeyBsYWJlbDogJ1x1NTQ2OFx1NjcxRlx1NjAyN1x1NEVGQlx1NTJBMScgfSxcbiAgICAgICAgcmVjdXJyZW5jZV90eXBlOiB7XG4gICAgICAgICAgbGFiZWw6ICdcdTkxQ0RcdTU5MERcdTdDN0JcdTU3OEInLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIGRhaWx5OiAnXHU2QkNGXHU1OTI5JyxcbiAgICAgICAgICAgIHdlZWtseTogJ1x1NkJDRlx1NTQ2OCcsXG4gICAgICAgICAgICBtb250aGx5OiAnXHU2QkNGXHU2NzA4JyxcbiAgICAgICAgICAgIHllYXJseTogJ1x1NkJDRlx1NUU3NCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgcmVjdXJyZW5jZV9pbnRlcnZhbDogeyBsYWJlbDogJ1x1OTFDRFx1NTkwRFx1OTVGNFx1OTY5NCcgfSxcbiAgICAgICAgaXNfY29tcGxldGVkOiB7IGxhYmVsOiAnXHU2NjJGXHU1NDI2XHU1QjhDXHU2MjEwJyB9LFxuICAgICAgICBpc19vdmVyZHVlOiB7IGxhYmVsOiAnXHU2NjJGXHU1NDI2XHU5MDNFXHU2NzFGJyB9LFxuICAgICAgICBwcm9ncmVzc19wZXJjZW50OiB7IGxhYmVsOiAnXHU4RkRCXHU1RUE2ICglKScgfSxcbiAgICAgICAgZXN0aW1hdGVkX2hvdXJzOiB7IGxhYmVsOiAnXHU5ODg0XHU0RjMwXHU1REU1XHU2NUY2JyB9LFxuICAgICAgICBhY3R1YWxfaG91cnM6IHsgbGFiZWw6ICdcdTVCOUVcdTk2NDVcdTVERTVcdTY1RjYnIH0sXG4gICAgICAgIG5vdGVzOiB7IGxhYmVsOiAnXHU1OTA3XHU2Q0U4JyB9LFxuICAgICAgICBjYXRlZ29yeV9jb2xvcjogeyBsYWJlbDogJ1x1NTIwNlx1N0M3Qlx1OTg5Q1x1ODI3MicgfSxcbiAgICAgIH0sXG4gICAgfSBzYXRpc2ZpZXMgVGFza1RyYW5zbGF0aW9uLFxuICB9LFxuICBhcHBzOiB7XG4gICAgdG9kb19hcHA6IHtcbiAgICAgIGxhYmVsOiAnXHU1Rjg1XHU1MjlFXHU3QkExXHU3NDA2JyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU0RTJBXHU0RUJBXHU0RUZCXHU1MkExXHU3QkExXHU3NDA2XHU1RTk0XHU3NTI4JyxcbiAgICB9LFxuICB9LFxuICBtZXNzYWdlczoge1xuICAgICdjb21tb24uc2F2ZSc6ICdcdTRGRERcdTVCNTgnLFxuICAgICdjb21tb24uY2FuY2VsJzogJ1x1NTNENlx1NkQ4OCcsXG4gICAgJ2NvbW1vbi5kZWxldGUnOiAnXHU1MjIwXHU5NjY0JyxcbiAgICAnY29tbW9uLmVkaXQnOiAnXHU3RjE2XHU4RjkxJyxcbiAgICAnY29tbW9uLmNyZWF0ZSc6ICdcdTY1QjBcdTVFRkEnLFxuICAgICdjb21tb24uc2VhcmNoJzogJ1x1NjQxQ1x1N0QyMicsXG4gICAgJ2NvbW1vbi5maWx0ZXInOiAnXHU3QjVCXHU5MDA5JyxcbiAgICAnY29tbW9uLnNvcnQnOiAnXHU2MzkyXHU1RThGJyxcbiAgICAnY29tbW9uLnJlZnJlc2gnOiAnXHU1MjM3XHU2NUIwJyxcbiAgICAnY29tbW9uLmV4cG9ydCc6ICdcdTVCRkNcdTUxRkEnLFxuICAgICdjb21tb24uYmFjayc6ICdcdThGRDRcdTU2REUnLFxuICAgICdjb21tb24uY29uZmlybSc6ICdcdTc4NkVcdThCQTQnLFxuICAgICdzdWNjZXNzLnNhdmVkJzogJ1x1NEZERFx1NUI1OFx1NjIxMFx1NTI5RicsXG4gICAgJ3N1Y2Nlc3MuZGVsZXRlZCc6ICdcdTUyMjBcdTk2NjRcdTYyMTBcdTUyOUYnLFxuICAgICdzdWNjZXNzLmNvbXBsZXRlZCc6ICdcdTRFRkJcdTUyQTFcdTVERjJcdTY4MDdcdThCQjBcdTRFM0FcdTVCOENcdTYyMTAnLFxuICAgICdjb25maXJtLmRlbGV0ZSc6ICdcdTc4NkVcdTVCOUFcdTg5ODFcdTUyMjBcdTk2NjRcdTZCNjRcdTRFRkJcdTUyQTFcdTU0MTdcdUZGMUYnLFxuICAgICdjb25maXJtLmNvbXBsZXRlJzogJ1x1Nzg2RVx1NUI5QVx1NUMwNlx1NkI2NFx1NEVGQlx1NTJBMVx1NjgwN1x1OEJCMFx1NEUzQVx1NUI4Q1x1NjIxMFx1RkYxRicsXG4gICAgJ2Vycm9yLnJlcXVpcmVkJzogJ1x1NkI2NFx1NUI1N1x1NkJCNVx1NEUzQVx1NUZDNVx1NTg2Qlx1OTg3OScsXG4gICAgJ2Vycm9yLmxvYWRfZmFpbGVkJzogJ1x1NjU3MFx1NjM2RVx1NTJBMFx1OEY3RFx1NTkzMVx1OEQyNScsXG4gIH0sXG4gIHZhbGlkYXRpb25NZXNzYWdlczoge1xuICAgIGNvbXBsZXRlZF9kYXRlX3JlcXVpcmVkOiAnXHU3MkI2XHU2MDAxXHU0RTNBXCJcdTVERjJcdTVCOENcdTYyMTBcIlx1NjVGNlx1RkYwQ1x1NUI4Q1x1NjIxMFx1NjVFNVx1NjcxRlx1NEUzQVx1NUZDNVx1NTg2Qlx1OTg3OScsXG4gICAgcmVjdXJyZW5jZV9maWVsZHNfcmVxdWlyZWQ6ICdcdTU0NjhcdTY3MUZcdTYwMjdcdTRFRkJcdTUyQTFcdTVGQzVcdTk4N0JcdTYzMDdcdTVCOUFcdTkxQ0RcdTU5MERcdTdDN0JcdTU3OEInLFxuICB9LFxufTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC10b2RvL3NyYy90cmFuc2xhdGlvbnMvamEtSlAudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL3Ryb3lzdS9Eb2N1bWVudHMvR2l0SHViL3NwZWMvZXhhbXBsZXMvYXBwLXRvZG8vc3JjL3RyYW5zbGF0aW9uc1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtdG9kby9zcmMvdHJhbnNsYXRpb25zL2phLUpQLnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5pbXBvcnQgdHlwZSB7IFRyYW5zbGF0aW9uRGF0YSB9IGZyb20gJ0BvYmplY3RzdGFjay9zcGVjL3N5c3RlbSc7XG5cbi8qKlxuICogXHU2NUU1XHU2NzJDXHU4QTlFIChqYS1KUCkgXHUyMDE0IFRvZG8gQXBwIFRyYW5zbGF0aW9uc1xuICpcbiAqIFBlci1sb2NhbGUgZmlsZTogb25lIGZpbGUgcGVyIGxhbmd1YWdlLCBmb2xsb3dpbmcgdGhlIGBwZXJfbG9jYWxlYCBjb252ZW50aW9uLlxuICovXG5leHBvcnQgY29uc3QgamFKUDogVHJhbnNsYXRpb25EYXRhID0ge1xuICBvYmplY3RzOiB7XG4gICAgdGFzazoge1xuICAgICAgbGFiZWw6ICdcdTMwQkZcdTMwQjlcdTMwQUYnLFxuICAgICAgcGx1cmFsTGFiZWw6ICdcdTMwQkZcdTMwQjlcdTMwQUYnLFxuICAgICAgZmllbGRzOiB7XG4gICAgICAgIHN1YmplY3Q6IHsgbGFiZWw6ICdcdTRFRjZcdTU0MEQnLCBoZWxwOiAnXHUzMEJGXHUzMEI5XHUzMEFGXHUzMDZFXHU3QzIxXHU1MzU4XHUzMDZBXHUzMEJGXHUzMEE0XHUzMEM4XHUzMEVCJyB9LFxuICAgICAgICBkZXNjcmlwdGlvbjogeyBsYWJlbDogJ1x1OEFBQ1x1NjYwRScgfSxcbiAgICAgICAgc3RhdHVzOiB7XG4gICAgICAgICAgbGFiZWw6ICdcdTMwQjlcdTMwQzZcdTMwRkNcdTMwQkZcdTMwQjknLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIG5vdF9zdGFydGVkOiAnXHU2NzJBXHU3NzQwXHU2MjRCJyxcbiAgICAgICAgICAgIGluX3Byb2dyZXNzOiAnXHU5MDMyXHU4ODRDXHU0RTJEJyxcbiAgICAgICAgICAgIHdhaXRpbmc6ICdcdTVGODVcdTZBNUZcdTRFMkQnLFxuICAgICAgICAgICAgY29tcGxldGVkOiAnXHU1QjhDXHU0RTg2JyxcbiAgICAgICAgICAgIGRlZmVycmVkOiAnXHU1RUY2XHU2NzFGJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBwcmlvcml0eToge1xuICAgICAgICAgIGxhYmVsOiAnXHU1MTJBXHU1MTQ4XHU1RUE2JyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBsb3c6ICdcdTRGNEUnLFxuICAgICAgICAgICAgbm9ybWFsOiAnXHU5MDFBXHU1RTM4JyxcbiAgICAgICAgICAgIGhpZ2g6ICdcdTlBRDgnLFxuICAgICAgICAgICAgdXJnZW50OiAnXHU3RENBXHU2MDI1JyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBjYXRlZ29yeToge1xuICAgICAgICAgIGxhYmVsOiAnXHUzMEFCXHUzMEM2XHUzMEI0XHUzMEVBJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBwZXJzb25hbDogJ1x1NTAwQlx1NEVCQScsXG4gICAgICAgICAgICB3b3JrOiAnXHU0RUQ1XHU0RThCJyxcbiAgICAgICAgICAgIHNob3BwaW5nOiAnXHU4Q0I3XHUzMDQ0XHU3MjY5JyxcbiAgICAgICAgICAgIGhlYWx0aDogJ1x1NTA2NVx1NUVCNycsXG4gICAgICAgICAgICBmaW5hbmNlOiAnXHU4Q0ExXHU1MkQ5JyxcbiAgICAgICAgICAgIG90aGVyOiAnXHUzMDVEXHUzMDZFXHU0RUQ2JyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBkdWVfZGF0ZTogeyBsYWJlbDogJ1x1NjcxRlx1NjVFNScgfSxcbiAgICAgICAgcmVtaW5kZXJfZGF0ZTogeyBsYWJlbDogJ1x1MzBFQVx1MzBERVx1MzBBNFx1MzBGM1x1MzBDMFx1MzBGQ1x1NjVFNVx1NjY0MicgfSxcbiAgICAgICAgY29tcGxldGVkX2RhdGU6IHsgbGFiZWw6ICdcdTVCOENcdTRFODZcdTY1RTUnIH0sXG4gICAgICAgIG93bmVyOiB7IGxhYmVsOiAnXHU2MkM1XHU1RjUzXHU4MDA1JyB9LFxuICAgICAgICB0YWdzOiB7XG4gICAgICAgICAgbGFiZWw6ICdcdTMwQkZcdTMwQjAnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIGltcG9ydGFudDogJ1x1OTFDRFx1ODk4MScsXG4gICAgICAgICAgICBxdWlja193aW46ICdcdTMwQUZcdTMwQTRcdTMwQzNcdTMwQUZcdTMwQTZcdTMwQTNcdTMwRjMnLFxuICAgICAgICAgICAgYmxvY2tlZDogJ1x1MzBENlx1MzBFRFx1MzBDM1x1MzBBRlx1NEUyRCcsXG4gICAgICAgICAgICBmb2xsb3dfdXA6ICdcdTMwRDVcdTMwQTlcdTMwRURcdTMwRkNcdTMwQTJcdTMwQzNcdTMwRDcnLFxuICAgICAgICAgICAgcmV2aWV3OiAnXHUzMEVDXHUzMEQzXHUzMEU1XHUzMEZDJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBpc19yZWN1cnJpbmc6IHsgbGFiZWw6ICdcdTdFNzBcdTMwOEFcdThGRDRcdTMwNTdcdTMwQkZcdTMwQjlcdTMwQUYnIH0sXG4gICAgICAgIHJlY3VycmVuY2VfdHlwZToge1xuICAgICAgICAgIGxhYmVsOiAnXHU3RTcwXHUzMDhBXHU4RkQ0XHUzMDU3XHUzMEJGXHUzMEE0XHUzMEQ3JyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBkYWlseTogJ1x1NkJDRVx1NjVFNScsXG4gICAgICAgICAgICB3ZWVrbHk6ICdcdTZCQ0VcdTkwMzEnLFxuICAgICAgICAgICAgbW9udGhseTogJ1x1NkJDRVx1NjcwOCcsXG4gICAgICAgICAgICB5ZWFybHk6ICdcdTZCQ0VcdTVFNzQnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHJlY3VycmVuY2VfaW50ZXJ2YWw6IHsgbGFiZWw6ICdcdTdFNzBcdTMwOEFcdThGRDRcdTMwNTdcdTk1OTNcdTk2OTQnIH0sXG4gICAgICAgIGlzX2NvbXBsZXRlZDogeyBsYWJlbDogJ1x1NUI4Q1x1NEU4Nlx1NkUwOFx1MzA3RicgfSxcbiAgICAgICAgaXNfb3ZlcmR1ZTogeyBsYWJlbDogJ1x1NjcxRlx1OTY1MFx1OEQ4NVx1OTA0RScgfSxcbiAgICAgICAgcHJvZ3Jlc3NfcGVyY2VudDogeyBsYWJlbDogJ1x1OTAzMlx1NjM1N1x1NzM4NyAoJSknIH0sXG4gICAgICAgIGVzdGltYXRlZF9ob3VyczogeyBsYWJlbDogJ1x1ODk4Qlx1N0E0RFx1NjY0Mlx1OTU5MycgfSxcbiAgICAgICAgYWN0dWFsX2hvdXJzOiB7IGxhYmVsOiAnXHU1QjlGXHU3RTNFXHU2NjQyXHU5NTkzJyB9LFxuICAgICAgICBub3RlczogeyBsYWJlbDogJ1x1MzBFMVx1MzBFMicgfSxcbiAgICAgICAgY2F0ZWdvcnlfY29sb3I6IHsgbGFiZWw6ICdcdTMwQUJcdTMwQzZcdTMwQjRcdTMwRUFcdTgyNzInIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIGFwcHM6IHtcbiAgICB0b2RvX2FwcDoge1xuICAgICAgbGFiZWw6ICdUb0RvIFx1MzBERVx1MzBDRFx1MzBGQ1x1MzBCOFx1MzBFM1x1MzBGQycsXG4gICAgICBkZXNjcmlwdGlvbjogJ1x1NTAwQlx1NEVCQVx1MzBCRlx1MzBCOVx1MzBBRlx1N0JBMVx1NzQwNlx1MzBBMlx1MzBEN1x1MzBFQVx1MzBCMVx1MzBGQ1x1MzBCN1x1MzBFN1x1MzBGMycsXG4gICAgfSxcbiAgfSxcbiAgbWVzc2FnZXM6IHtcbiAgICAnY29tbW9uLnNhdmUnOiAnXHU0RkREXHU1QjU4JyxcbiAgICAnY29tbW9uLmNhbmNlbCc6ICdcdTMwQURcdTMwRTNcdTMwRjNcdTMwQkJcdTMwRUInLFxuICAgICdjb21tb24uZGVsZXRlJzogJ1x1NTI0QVx1OTY2NCcsXG4gICAgJ2NvbW1vbi5lZGl0JzogJ1x1N0RFOFx1OTZDNicsXG4gICAgJ2NvbW1vbi5jcmVhdGUnOiAnXHU2NUIwXHU4OThGXHU0RjVDXHU2MjEwJyxcbiAgICAnY29tbW9uLnNlYXJjaCc6ICdcdTY5MUNcdTdEMjInLFxuICAgICdjb21tb24uZmlsdGVyJzogJ1x1MzBENVx1MzBBM1x1MzBFQlx1MzBCRlx1MzBGQycsXG4gICAgJ2NvbW1vbi5zb3J0JzogJ1x1NEUyNlx1MzA3OVx1NjZGRlx1MzA0OCcsXG4gICAgJ2NvbW1vbi5yZWZyZXNoJzogJ1x1NjZGNFx1NjVCMCcsXG4gICAgJ2NvbW1vbi5leHBvcnQnOiAnXHUzMEE4XHUzMEFGXHUzMEI5XHUzMEREXHUzMEZDXHUzMEM4JyxcbiAgICAnY29tbW9uLmJhY2snOiAnXHU2MjNCXHUzMDhCJyxcbiAgICAnY29tbW9uLmNvbmZpcm0nOiAnXHU3OEJBXHU4QThEJyxcbiAgICAnc3VjY2Vzcy5zYXZlZCc6ICdcdTRGRERcdTVCNThcdTMwNTdcdTMwN0VcdTMwNTdcdTMwNUYnLFxuICAgICdzdWNjZXNzLmRlbGV0ZWQnOiAnXHU1MjRBXHU5NjY0XHUzMDU3XHUzMDdFXHUzMDU3XHUzMDVGJyxcbiAgICAnc3VjY2Vzcy5jb21wbGV0ZWQnOiAnXHUzMEJGXHUzMEI5XHUzMEFGXHUzMDkyXHU1QjhDXHU0RTg2XHUzMDZCXHUzMDU3XHUzMDdFXHUzMDU3XHUzMDVGJyxcbiAgICAnY29uZmlybS5kZWxldGUnOiAnXHUzMDUzXHUzMDZFXHUzMEJGXHUzMEI5XHUzMEFGXHUzMDkyXHU1MjRBXHU5NjY0XHUzMDU3XHUzMDY2XHUzMDgyXHUzMDg4XHUzMDhEXHUzMDU3XHUzMDQ0XHUzMDY3XHUzMDU5XHUzMDRCXHVGRjFGJyxcbiAgICAnY29uZmlybS5jb21wbGV0ZSc6ICdcdTMwNTNcdTMwNkVcdTMwQkZcdTMwQjlcdTMwQUZcdTMwOTJcdTVCOENcdTRFODZcdTMwNkJcdTMwNTdcdTMwN0VcdTMwNTlcdTMwNEJcdUZGMUYnLFxuICAgICdlcnJvci5yZXF1aXJlZCc6ICdcdTMwNTNcdTMwNkVcdTk4MDVcdTc2RUVcdTMwNkZcdTVGQzVcdTk4MDhcdTMwNjdcdTMwNTknLFxuICAgICdlcnJvci5sb2FkX2ZhaWxlZCc6ICdcdTMwQzdcdTMwRkNcdTMwQkZcdTMwNkVcdThBQURcdTMwN0ZcdThGQkNcdTMwN0ZcdTMwNkJcdTU5MzFcdTY1NTdcdTMwNTdcdTMwN0VcdTMwNTdcdTMwNUYnLFxuICB9LFxuICB2YWxpZGF0aW9uTWVzc2FnZXM6IHtcbiAgICBjb21wbGV0ZWRfZGF0ZV9yZXF1aXJlZDogJ1x1MzBCOVx1MzBDNlx1MzBGQ1x1MzBCRlx1MzBCOVx1MzA0Q1x1MzAwQ1x1NUI4Q1x1NEU4Nlx1MzAwRFx1MzA2RVx1NTgzNFx1NTQwOFx1MzAwMVx1NUI4Q1x1NEU4Nlx1NjVFNVx1MzA2Rlx1NUZDNVx1OTgwOFx1MzA2N1x1MzA1OScsXG4gICAgcmVjdXJyZW5jZV9maWVsZHNfcmVxdWlyZWQ6ICdcdTdFNzBcdTMwOEFcdThGRDRcdTMwNTdcdTMwQkZcdTMwQjlcdTMwQUZcdTMwNkJcdTMwNkZcdTdFNzBcdTMwOEFcdThGRDRcdTMwNTdcdTMwQkZcdTMwQTRcdTMwRDdcdTMwNENcdTVGQzVcdTg5ODFcdTMwNjdcdTMwNTknLFxuICB9LFxufTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC10b2RvL3NyYy90cmFuc2xhdGlvbnMvdG9kby50cmFuc2xhdGlvbi50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9hcHAtdG9kby9zcmMvdHJhbnNsYXRpb25zXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL2FwcC10b2RvL3NyYy90cmFuc2xhdGlvbnMvdG9kby50cmFuc2xhdGlvbi50c1wiOy8vIENvcHlyaWdodCAoYykgMjAyNSBPYmplY3RTdGFjay4gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZS0yLjAgbGljZW5zZS5cblxuaW1wb3J0IHR5cGUgeyBUcmFuc2xhdGlvbkJ1bmRsZSB9IGZyb20gJ0BvYmplY3RzdGFjay9zcGVjL3N5c3RlbSc7XG5pbXBvcnQgeyBlbiB9IGZyb20gJy4vZW4nO1xuaW1wb3J0IHsgemhDTiB9IGZyb20gJy4vemgtQ04nO1xuaW1wb3J0IHsgamFKUCB9IGZyb20gJy4vamEtSlAnO1xuXG4vKipcbiAqIFRvZG8gQXBwIFx1MjAxNCBJbnRlcm5hdGlvbmFsaXphdGlvbiAoaTE4bilcbiAqXG4gKiBEZW1vbnN0cmF0ZXMgKipwZXItbG9jYWxlIGZpbGUgc3BsaXR0aW5nKiogY29udmVudGlvbjpcbiAqIGVhY2ggbGFuZ3VhZ2UgaXMgZGVmaW5lZCBpbiBpdHMgb3duIGZpbGUgKGBlbi50c2AsIGB6aC1DTi50c2AsIGBqYS1KUC50c2ApXG4gKiBhbmQgYXNzZW1ibGVkIGludG8gYSBzaW5nbGUgYFRyYW5zbGF0aW9uQnVuZGxlYCBoZXJlLlxuICpcbiAqIEZvciBsYXJnZSBwcm9qZWN0cyB3aXRoIG1hbnkgb2JqZWN0cywgdXNlIGBwZXJfbmFtZXNwYWNlYCBvcmdhbml6YXRpb25cbiAqIHRvIGZ1cnRoZXIgc3BsaXQgZWFjaCBsb2NhbGUgaW50byBwZXItb2JqZWN0IGZpbGVzIChzZWUgaTE4bi1zdGFuZGFyZCBkb2NzKS5cbiAqXG4gKiBTdXBwb3J0ZWQgbG9jYWxlczogZW4gKEVuZ2xpc2gpLCB6aC1DTiAoQ2hpbmVzZSksIGphLUpQIChKYXBhbmVzZSlcbiAqL1xuZXhwb3J0IGNvbnN0IFRvZG9UcmFuc2xhdGlvbnM6IFRyYW5zbGF0aW9uQnVuZGxlID0ge1xuICBlbixcbiAgJ3poLUNOJzogemhDTixcbiAgJ2phLUpQJzogamFKUCxcbn07XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9wbHVnaW4tYmkvb2JqZWN0c3RhY2suY29uZmlnLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy90cm95c3UvRG9jdW1lbnRzL0dpdEh1Yi9zcGVjL2V4YW1wbGVzL3BsdWdpbi1iaVwiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvdHJveXN1L0RvY3VtZW50cy9HaXRIdWIvc3BlYy9leGFtcGxlcy9wbHVnaW4tYmkvb2JqZWN0c3RhY2suY29uZmlnLnRzXCI7Ly8gQ29weXJpZ2h0IChjKSAyMDI1IE9iamVjdFN0YWNrLiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlLTIuMCBsaWNlbnNlLlxuXG5pbXBvcnQgeyBkZWZpbmVTdGFjayB9IGZyb20gJ0BvYmplY3RzdGFjay9zcGVjJztcblxuLyoqXG4gKiBCSSBQbHVnaW4gLSBCdXNpbmVzcyBJbnRlbGxpZ2VuY2UgRGFzaGJvYXJkXG4gKiBcbiAqIFRoaXMgcGx1Z2luIHByb3ZpZGVzIGFuYWx5dGljcyBhbmQgcmVwb3J0aW5nIGNhcGFiaWxpdGllcy5cbiAqIChQbGFjZWhvbGRlciAtIHRvIGJlIGltcGxlbWVudGVkKVxuICovXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVTdGFjayh7XG4gIG1hbmlmZXN0OiB7XG4gICAgaWQ6ICdjb20uZXhhbXBsZS5iaScsXG4gICAgbmFtZXNwYWNlOiAnYmknLFxuICAgIHZlcnNpb246ICcxLjAuMCcsXG4gICAgdHlwZTogJ3BsdWdpbicsXG4gICAgbmFtZTogJ0JJIFBsdWdpbicsXG4gICAgZGVzY3JpcHRpb246ICdCdXNpbmVzcyBJbnRlbGxpZ2VuY2UgZGFzaGJvYXJkcyBhbmQgYW5hbHl0aWNzJyxcbiAgfSxcbiAgXG4gIC8vIFBsYWNlaG9sZGVyIC0gbm8gb2JqZWN0cyBvciBkYXNoYm9hcmRzIHlldFxuICBvYmplY3RzOiBbXSxcbiAgZGFzaGJvYXJkczogW10sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBOzs7QUNFQSxTQUFTLGVBQUFBLG9CQUFtQjtBQUM1QixTQUFTLFdBQVcsb0JBQW9CO0FBQ3hDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsa0JBQWtCOzs7QUNKM0IsU0FBUyxtQkFBbUI7OztBQ0Y1QjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTs7O0FDRUEsU0FBUyxjQUFjLGFBQWE7QUFFN0IsSUFBTSxVQUFVLGFBQWEsT0FBTztBQUFBLEVBQ3pDLE1BQU07QUFBQSxFQUNOLE9BQU87QUFBQSxFQUNQLGFBQWE7QUFBQSxFQUNiLE1BQU07QUFBQSxFQUNOLGFBQWE7QUFBQSxFQUNiLGFBQWE7QUFBQSxFQUNiLGVBQWUsQ0FBQyxrQkFBa0IsUUFBUSxRQUFRLE9BQU87QUFBQSxFQUV6RCxRQUFRO0FBQUE7QUFBQSxJQUVOLGdCQUFnQixNQUFNLFdBQVc7QUFBQSxNQUMvQixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsSUFDVixDQUFDO0FBQUE7QUFBQSxJQUdELE1BQU0sTUFBTSxLQUFLO0FBQUEsTUFDZixPQUFPO0FBQUEsTUFDUCxVQUFVO0FBQUEsTUFDVixZQUFZO0FB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O0FBQUEsRUFDbkMsU0FBUyxRQUFRLElBQUkseUJBQXlCLFFBQVEsSUFBSSxhQUN0RCxXQUFXLFFBQVEsSUFBSSxVQUFVLEtBQ2pDO0FBQ04sQ0FBQztBQUVELElBQU9DLDhCQUFRQyxhQUFZO0FBQUEsRUFDekIsVUFBVTtBQUFBLElBQ1IsSUFBSTtBQUFBLElBQ0osTUFBTTtBQUFBLElBQ04sU0FBUztBQUFBLElBQ1QsYUFBYTtBQUFBLElBQ2IsTUFBTTtBQUFBLEVBQ1I7QUFBQTtBQUFBO0FBQUEsRUFJQSxTQUFTO0FBQUEsSUFDUCxJQUFJLGVBQWU7QUFBQTtBQUFBLElBRW5CLElBQUksYUFBYSxJQUFJLGVBQWUsQ0FBQztBQUFBO0FBQUEsSUFFckM7QUFBQTtBQUFBLElBRUEsSUFBSSxVQUFVLDBCQUFNO0FBQUEsSUFDcEIsSUFBSSxVQUFVRCwyQkFBTztBQUFBLElBQ3JCLElBQUksVUFBVUEsMkJBQWdCO0FBQUEsRUFDaEM7QUFDRixDQUFDO0FBNkNNLElBQU0scUJBQXFCQyxhQUFZO0FBQUEsRUFDNUMsVUFBVTtBQUFBLElBQ1IsSUFBSTtBQUFBLElBQ0osTUFBTTtBQUFBLElBQ04sU0FBUztBQUFBLElBQ1QsYUFBYTtBQUFBLElBQ2IsTUFBTTtBQUFBLEVBQ1I7QUFBQTtBQUFBLEVBR0EsU0FBUztBQUFBLElBQ1AsSUFBSSxlQUFlO0FBQUEsSUFDbkIsSUFBSSxhQUFhLElBQUksZUFBZSxDQUFDO0FBQUEsSUFDckM7QUFBQSxJQUNBLElBQUksVUFBVSwwQkFBTTtBQUFBLElBQ3BCLElBQUksVUFBVUQsMkJBQU87QUFBQSxJQUNyQixJQUFJLFVBQVVBLDJCQUFnQjtBQUFBLEVBQ2hDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFsiZGVmaW5lU3RhY2siLCAiT2JqZWN0U2NoZW1hIiwgIkZpZWxkIiwgIk9iamVjdFNjaGVtYSIsICJGaWVsZCIsICJPYmplY3RTY2hlbWEiLCAiRmllbGQiLCAiT2JqZWN0U2NoZW1hIiwgIkZpZWxkIiwgIk9iamVjdFNjaGVtYSIsICJGaWVsZCIsICJPYmplY3RTY2hlbWEiLCAiRmllbGQiLCAiT2JqZWN0U2NoZW1hIiwgIkZpZWxkIiwgIk9iamVjdFNjaGVtYSIsICJGaWVsZCIsICJPYmplY3RTY2hlbWEiLCAiRmllbGQiLCAiT2JqZWN0U2NoZW1hIiwgIkZpZWxkIiwgIk9iamVjdFNjaGVtYSIsICJGaWVsZCIsICJPYmplY3RTY2hlbWEiLCAiRmllbGQiLCAiT2JqZWN0U2NoZW1hIiwgIkZpZWxkIiwgIk9iamVjdFNjaGVtYSIsICJGaWVsZCIsICJPYmplY3RTY2hlbWEiLCAiRmllbGQiLCAiT2JqZWN0U2NoZW1hIiwgIkZpZWxkIiwgIk9iamVjdFNjaGVtYSIsICJGaWVsZCIsICJPYmplY3RTY2hlbWEiLCAiRmllbGQiLCAiQXBpRW5kcG9pbnQiLCAiQXBpRW5kcG9pbnQiLCAiQ3JtQXBwIiwgImRlZmluZVN0YWNrIiwgIm9iamVjdHNfZXhwb3J0cyIsICJUYXNrIiwgIk9iamVjdFNjaGVtYSIsICJGaWVsZCIsICJUYXNrIiwgIk9iamVjdFNjaGVtYSIsICJGaWVsZCIsICJhY3Rpb25zX2V4cG9ydHMiLCAiRXhwb3J0VG9Dc3ZBY3Rpb24iLCAiRXhwb3J0VG9Dc3ZBY3Rpb24iLCAiZGFzaGJvYXJkc19leHBvcnRzIiwgInJlcG9ydHNfZXhwb3J0cyIsICJUYXNrc0J5T3duZXJSZXBvcnQiLCAiVGFza3NCeU93bmVyUmVwb3J0IiwgImZsb3dzX2V4cG9ydHMiLCAiYXBwc19leHBvcnRzIiwgIkFwcCIsICJBcHAiLCAidHJhbnNsYXRpb25zX2V4cG9ydHMiLCAiZW4iLCAiemhDTiIsICJqYUpQIiwgImVuIiwgInpoQ04iLCAiamFKUCIsICJvYmplY3RzdGFja19jb25maWdfZGVmYXVsdCIsICJkZWZpbmVTdGFjayIsICJvYmplY3RzX2V4cG9ydHMiLCAiYWN0aW9uc19leHBvcnRzIiwgImRhc2hib2FyZHNfZXhwb3J0cyIsICJyZXBvcnRzX2V4cG9ydHMiLCAiZmxvd3NfZXhwb3J0cyIsICJhcHBzX2V4cG9ydHMiLCAidHJhbnNsYXRpb25zX2V4cG9ydHMiLCAiZGVmaW5lU3RhY2siLCAib2JqZWN0c3RhY2tfY29uZmlnX2RlZmF1bHQiLCAiZGVmaW5lU3RhY2siLCAib2JqZWN0c3RhY2tfY29uZmlnX2RlZmF1bHQiLCAiZGVmaW5lU3RhY2siXQp9Cg==
