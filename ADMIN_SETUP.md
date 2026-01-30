# Admin User Setup

This CRM application requires an admin user to be created. Follow these steps to create your first admin user:

## Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard at https://supabase.com/dashboard
2. Navigate to **Authentication** > **Users**
3. Click **Add user** > **Create new user**
4. Fill in the form:
   - **Email**: Enter the admin email (e.g., `admin@yourcompany.com`)
   - **Password**: Enter a secure password (e.g., `Admin@123456`)
   - **Auto Confirm User**: ✅ Check this box
5. Click **Create user**

6. The system will automatically create a profile for this user
7. Now you need to update the user's role to ADMIN:
   - Go to **Table Editor** > **profiles**
   - Find the row for the user you just created
   - Click to edit the row
   - Change the `role` field from `SALES_REP` to `ADMIN`
   - Set `password_change_required` to `true`
   - Click **Save**

8. You can now log in with the admin credentials at `/login`

## Option 2: Using the App After First User Creation

If you already have at least one user account:

1. Log in to the Supabase Dashboard
2. Go to **Table Editor** > **profiles**
3. Find your user in the profiles table
4. Edit the `role` field to `ADMIN`
5. Save the changes
6. Log out and log back in

## Default Admin Credentials (for development only)

For development/testing, you can create an admin user with these credentials:

- **Email**: `admin@example.com`
- **Password**: `Admin@123!` (user will be forced to change on first login)

## Security Notes

- **IMPORTANT**: Always change the default password immediately after first login
- Admin users have full system access including:
  - Creating and managing all users
  - Viewing and editing all records regardless of owner
  - Deleting any data
  - Accessing admin settings

## Troubleshooting

If you can't access the admin panel after setting up an admin user:

1. Clear your browser cache and cookies
2. Log out completely
3. Log back in with the admin credentials
4. Check the profile role in the database to confirm it's set to `ADMIN`

## Role Hierarchy

The system supports the following roles:

- **ADMIN**: Full system access, can manage users and all data
- **MANAGER**: Can view and edit all records, cannot manage users
- **SALES_REP**: Can only view/edit their own records
- **READ_ONLY**: Can only view records they're assigned to
