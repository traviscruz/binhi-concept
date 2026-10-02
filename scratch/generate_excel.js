import XLSX from 'xlsx';
import path from 'path';
import fileSystem from 'fs';

// 1. Test Accounts Sheet
const testAccountsData = [
  ["Role Name", "Email Address", "Password Options", "Portal Route / Page", "Access Level & Notes"],
  ["System Admin", "traviscruz2021@gmail.com", "123Travis or 123Traviss", "/admin", "Full administrative control, booking approvals, staff management, financial reports, audit logs"],
  ["Inventory Manager", "videogreet123@gmail.com", "123Travis or 123Traviss", "/inventory", "Inventory stock control, equipment maintenance, unit assignment, usage reports"],
  ["Crew Member 1", "melgrantcruz18@gmail.com", "123Travis or 123Traviss", "/crew", "Assigned event schedules, setup/teardown checklists, availability submission, event sign-off"],
  ["Crew Member 2", "appdevdatabase@gmail.com", "123Travis or 123Traviss", "/crew", "Assigned event schedules, setup/teardown checklists, availability submission, event sign-off"],
  ["Customer 1", "travisicho@gmail.com", "123Travis or 123Traviss", "/dashboard", "Book packages/equipment, custom builder, checkout (PayMongo/Maya), status tracker, loyalty"],
  ["Customer 2", "kopimendoza@gmail.com", "123Travis or 123Traviss", "/dashboard", "Book packages/equipment, checkout, booking history, post reviews, redeem rewards"],
  ["Affiliate / Partner", "ishwomarcaida@gmail.com", "123Travis or 123Traviss", "/partner", "Referral link generator, commission earnings tracker, payout request portal"]
];

// 2. High-Level Testing Workflow
const workflowOverviewData = [
  ["Step #", "Workflow Phase", "Role Responsible", "Action / Process", "Expected System Response"],
  [1, "Account Login", "Any Tester", "Navigate to https://binhiconcept.vercel.app and log in using designated account email & password", "User successfully authenticated and redirected to appropriate dashboard/role view"],
  [2, "Browse & Package Customization", "Customer", "Browse package catalog, select items/custom sound & light packages, specify event date & location", "Price calculated in real-time including transport fees and custom package breakdown"],
  [3, "Checkout & Payment", "Customer", "Proceed to checkout, enter contact details, choose payment method (PayMongo/Maya or Downpayment)", "Booking submitted; status set to Pending/Payment Verification; notification sent"],
  [4, "Booking Approval & Staffing", "System Admin", "Log in as Admin, review pending booking, assign Crew members and approve booking status", "Booking status updated to Approved/Confirmed; notification sent to crew and customer"],
  [5, "Inventory & Unit Allocation", "Inventory Manager", "Log in as Inventory Manager, inspect stock, assign specific serial units to the confirmed booking", "Items reserved and allocated; equipment status marked as assigned/in-use"],
  [6, "Crew Preparation & Execution", "Crew", "Log in as Crew, check assigned events, mark setup stages (Logistics -> Setup -> Sound Check -> Teardown)", "Real-time updates on setup progress visible to Admin and Customer"],
  [7, "Event Completion & Sign-off", "Crew & Admin", "Crew completes teardown, submits client sign-off; Admin marks booking as Completed", "Booking lifecycle finished; loyalty points credited to customer; inventory returned to stock"],
  [8, "Post-Event Review & Rewards", "Customer", "Log in as Customer, view completed booking, submit rating & review, inspect loyalty point balance", "Review posted to website; loyalty rewards available for future bookings"]
];

// 3. Test Cases: Customer & Public Features
const customerTestCases = [
  ["Test Case ID", "Feature Area", "Test Title", "Preconditions", "Test Steps", "Expected Result", "Status (Pass/Fail)"],
  ["TC-CUST-001", "Authentication", "Customer Login", "Valid Customer email & password", "1. Open https://binhiconcept.vercel.app/login\n2. Enter travisicho@gmail.com and password\n3. Click Login", "Successfully logs in and lands on Customer Dashboard", "Pending"],
  ["TC-CUST-002", "Catalog", "Browse Packages & Filters", "Logged in or Guest", "1. Go to Package Catalog\n2. Filter by event type or budget\n3. Click package details", "Package items, photos, inclusions, and base pricing displayed accurately", "Pending"],
  ["TC-CUST-003", "Custom Package", "Build Custom Sound & Light Package", "Logged in as Customer", "1. Navigate to Custom Package Builder\n2. Select specific speakers, lights, mixers\n3. Adjust quantities", "Total cost updates dynamically based on equipment selection and quantity", "Pending"],
  ["TC-CUST-004", "Checkout Flow", "Booking Submission & Payment", "Items in cart", "1. Click Checkout\n2. Fill event location and date\n3. Select payment mode (PayMongo/Maya)\n4. Submit", "Booking reference generated; redirected to payment prompt / confirmation page", "Pending"],
  ["TC-CUST-005", "Status Tracker", "Track Active Booking Status", "Existing active booking", "1. Navigate to Customer Dashboard / Booking Status\n2. View active booking card", "Displays live booking stage (Pending -> Approved -> On-site Setup -> Completed)", "Pending"],
  ["TC-CUST-006", "Loyalty Program", "View & Redeem Loyalty Points", "Customer with completed bookings", "1. Open Loyalty & Rewards page\n2. Check points balance\n3. Select available voucher code", "Points calculated correctly; voucher code generated for next checkout", "Pending"],
  ["TC-CUST-007", "Reviews", "Submit Rating & Review", "Completed booking present", "1. Go to My Reviews page\n2. Select completed event\n3. Rate 5 stars & write feedback\n4. Submit", "Review saved and submitted for admin moderation", "Pending"]
];

// 4. Test Cases: System Admin
const adminTestCases = [
  ["Test Case ID", "Feature Area", "Test Title", "Preconditions", "Test Steps", "Expected Result", "Status (Pass/Fail)"],
  ["TC-ADM-001", "Authentication", "Admin Login & Dashboard Access", "Admin credentials", "1. Open site login\n2. Log in with traviscruz2021@gmail.com\n3. Access /admin", "Admin Dashboard loads displaying high-level KPIs, revenue, and active bookings count", "Pending"],
  ["TC-ADM-002", "Bookings Management", "Approve / Confirm Booking", "Pending customer booking exists", "1. Open Admin Bookings Management\n2. Click on a pending booking\n3. Click 'Approve Booking'", "Booking status changes to Confirmed/Approved; customer notified", "Pending"],
  ["TC-ADM-003", "Staff Management", "Assign Crew to Event", "Confirmed booking present", "1. Select booking in Admin Panel\n2. Click 'Assign Staff'\n3. Select melgrantcruz18@gmail.com and appdevdatabase@gmail.com\n4. Save", "Selected crew members assigned to event and visible on crew dashboards", "Pending"],
  ["TC-ADM-004", "Manual Booking", "Create Offline / Manual Booking", "Admin logged in", "1. Open Manual Booking form\n2. Fill client details, venue, date, package\n3. Record manual downpayment\n4. Save", "New booking created directly into the system with confirmed status", "Pending"],
  ["TC-ADM-005", "Calendar View", "Inspect Event Calendar", "Bookings exist on system", "1. Navigate to Admin Event Calendar\n2. Change view (Month/Week/Day)", "All bookings rendered on correct dates with status badges", "Pending"],
  ["TC-ADM-006", "Vouchers & Promotions", "Create New Discount Voucher", "Admin logged in", "1. Navigate to Vouchers & Loyalty Settings\n2. Click 'Add Voucher'\n3. Set code, discount %, and expiry date\n4. Save", "Voucher created and redeemable by customers during checkout", "Pending"],
  ["TC-ADM-007", "Audit Logs", "Review System Audit Trail", "Admin logged in", "1. Navigate to Admin Audit Logs\n2. Filter by date or action type", "Log entries show timestamps, user IDs, and specific modified records", "Pending"]
];

// 5. Test Cases: Inventory Manager
const inventoryTestCases = [
  ["Test Case ID", "Feature Area", "Test Title", "Preconditions", "Test Steps", "Expected Result", "Status (Pass/Fail)"],
  ["TC-INV-001", "Authentication", "Inventory Manager Login", "Inventory Manager credentials", "1. Log in with videogreet123@gmail.com\n2. Navigate to /inventory", "Inventory Dashboard loads showing equipment stock, total items, and alerts", "Pending"],
  ["TC-INV-002", "Stock Management", "Add & Update Equipment Item", "Manager logged in", "1. Open Equipment Inventory table\n2. Click 'Add Item' or 'Edit'\n3. Update item quantity / serial numbers\n4. Save", "Equipment list updates immediately with revised stock numbers", "Pending"],
  ["TC-INV-003", "Unit Allocation", "Assign Specific Serial Units to Booking", "Booking approved by Admin", "1. Open Unit Assignment view\n2. Select upcoming event\n3. Pick specific speaker/light units by serial number\n4. Confirm assignment", "Units tagged as reserved/assigned for that date range", "Pending"],
  ["TC-INV-004", "Maintenance Logging", "Log Damaged or Under-Maintenance Unit", "Manager logged in", "1. Open Maintenance / Incident Reports\n2. Select item serial number\n3. Mark status as 'Under Repair'\n4. Add notes & submit", "Item deducted from available rentable inventory count until repaired", "Pending"],
  ["TC-INV-005", "Stock Alerts", "Low Stock & Overbooking Alerts", "Inventory Manager logged in", "1. Open Inventory Alerts page\n2. Review system notifications", "System highlights items with stock shortage for overlapping booking dates", "Pending"]
];

// 6. Test Cases: Crew Members
const crewTestCases = [
  ["Test Case ID", "Feature Area", "Test Title", "Preconditions", "Test Steps", "Expected Result", "Status (Pass/Fail)"],
  ["TC-CREW-001", "Authentication", "Crew Login & Assigned View", "Crew credentials", "1. Log in with melgrantcruz18@gmail.com or appdevdatabase@gmail.com\n2. Open /crew", "Crew Dashboard loads displaying assigned upcoming events", "Pending"],
  ["TC-CREW-002", "Availability", "Submit Crew Monthly Availability", "Crew logged in", "1. Open Crew Availability page\n2. Select available vs unavailable dates\n3. Save availability", "Dates updated for Admin when scheduling staff", "Pending"],
  ["TC-CREW-003", "Event Checklist", "Track Equipment Checklist on Site", "Assigned event today", "1. Open event details\n2. Check off loaded equipment items (Speakers, Cables, Mics, Lights)", "Checklist items marked completed; progress counter updates", "Pending"],
  ["TC-CREW-004", "Setup & Teardown", "Update Event Workflow Stages", "Assigned event active", "1. Open Setup/Teardown page\n2. Toggle stage from 'In Transit' -> 'Setup' -> 'Soundcheck' -> 'Teardown'", "Stage updates reflected live across Admin & Customer portals", "Pending"],
  ["TC-CREW-005", "Client Sign-off", "Record Client Completion Sign-off", "Event completed", "1. Select 'Client Sign-off'\n2. Record client signature / verbal confirmation note\n3. Complete event", "Event marked ready for admin final closure", "Pending"]
];

// 7. Test Cases: Affiliate / Partner
const affiliateTestCases = [
  ["Test Case ID", "Feature Area", "Test Title", "Preconditions", "Test Steps", "Expected Result", "Status (Pass/Fail)"],
  ["TC-AFF-001", "Authentication", "Partner Portal Login", "Affiliate credentials", "1. Log in with ishwomarcaida@gmail.com\n2. Navigate to /partner", "Partner Dashboard loads showing referral link and commission stats", "Pending"],
  ["TC-AFF-002", "Referral Link", "Generate & Copy Referral Link", "Affiliate logged in", "1. Click 'Copy Referral Link'\n2. Paste in new browser window", "URL contains affiliate tracking parameters; stores referral cookie/code", "Pending"],
  ["TC-AFF-003", "Commission Tracking", "View Earned Commissions", "Customer booked using referral link", "1. Open Earnings Summary on Partner Dashboard", "Displays booking reference, commission amount (%), and payment status", "Pending"]
];

// Create workbook
const wb = XLSX.utils.book_new();

const addSheet = (data, name) => {
  const ws = XLSX.utils.aoa_to_sheet(data);
  // Auto width calculation
  const colWidths = data[0].map((_, colIdx) => {
    let maxLen = 15;
    data.forEach(row => {
      const cellVal = row[colIdx] ? String(row[colIdx]) : "";
      const firstLine = cellVal.split('\n')[0];
      if (firstLine.length > maxLen) maxLen = firstLine.length;
    });
    return { wch: Math.min(maxLen + 3, 60) };
  });
  ws['!cols'] = colWidths;
  XLSX.utils.book_append_sheet(wb, ws, name);
};

addSheet(testAccountsData, "Test Accounts");
addSheet(workflowOverviewData, "Workflow Overview");
addSheet(customerTestCases, "Customer Test Cases");
addSheet(adminTestCases, "System Admin Test Cases");
addSheet(inventoryTestCases, "Inventory Manager Test Cases");
addSheet(crewTestCases, "Crew Test Cases");
addSheet(affiliateTestCases, "Affiliate Test Cases");

const outputPath = path.resolve('c:/Users/melgr/Documents/React/binhiconcept', 'BINHI_Testing_Workflow_and_Test_Cases.xlsx');
XLSX.writeFile(wb, outputPath);
console.log(`Excel file successfully created at: ${outputPath}`);
