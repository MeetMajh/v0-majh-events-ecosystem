-- MAJH ORGANIZATION ROLES RPC FUNCTIONS
-- Permission checking and role management

-- ===========================================
-- CHECK IF USER HAS PERMISSION
-- ===========================================
CREATE OR REPLACE FUNCTION has_permission(
  p_user_id UUID,
  p_tenant_id UUID,
  p_permission_key TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_member RECORD;
  v_override RECORD;
  v_has_scope BOOLEAN;
BEGIN
  -- Get member record
  SELECT * INTO v_member
  FROM organization_members
  WHERE user_id = p_user_id AND tenant_id = p_tenant_id AND is_active = true;
  
  IF NOT FOUND THEN
    -- Fallback to legacy tenant_memberships
    PERFORM 1 FROM tenant_memberships
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id;
    
    IF FOUND THEN
      -- Legacy member - grant basic permissions
      RETURN p_permission_key IN ('events.view', 'announcements.view');
    END IF;
    
    RETURN FALSE;
  END IF;
  
  -- Check for explicit override first
  SELECT * INTO v_override
  FROM member_permission_overrides
  WHERE member_id = v_member.id 
    AND permission_key = p_permission_key
    AND (expires_at IS NULL OR expires_at > NOW());
  
  IF FOUND THEN
    RETURN v_override.is_granted;
  END IF;
  
  -- Check if permission is in role template
  PERFORM 1 FROM role_template_permissions
  WHERE role_key = v_member.role_key AND permission_key = p_permission_key;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- If resource-specific, check scope
  IF p_resource_type IS NOT NULL AND p_resource_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM member_resource_scopes
      WHERE member_id = v_member.id
        AND (resource_type = 'all' OR (resource_type = p_resource_type AND resource_id = p_resource_id))
        AND (valid_until IS NULL OR valid_until > NOW())
    ) INTO v_has_scope;
    
    -- External roles (sponsor, venue, vendor) require explicit scope
    IF v_member.role_key IN ('sponsor', 'venue', 'vendor', 'observer') AND NOT v_has_scope THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ===========================================
-- GET USER PERMISSIONS FOR TENANT
-- ===========================================
CREATE OR REPLACE FUNCTION get_user_permissions(
  p_user_id UUID,
  p_tenant_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_member RECORD;
  v_permissions JSON;
BEGIN
  SELECT * INTO v_member
  FROM organization_members
  WHERE user_id = p_user_id AND tenant_id = p_tenant_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'role', 'none',
      'permissions', '[]'::json,
      'is_member', false
    );
  END IF;
  
  -- Get all effective permissions
  SELECT json_agg(DISTINCT permission_key) INTO v_permissions
  FROM (
    -- Role template permissions
    SELECT rtp.permission_key
    FROM role_template_permissions rtp
    WHERE rtp.role_key = v_member.role_key
    
    UNION
    
    -- Granted overrides
    SELECT mpo.permission_key
    FROM member_permission_overrides mpo
    WHERE mpo.member_id = v_member.id 
      AND mpo.is_granted = true
      AND (mpo.expires_at IS NULL OR mpo.expires_at > NOW())
    
    EXCEPT
    
    -- Revoked overrides
    SELECT mpo.permission_key
    FROM member_permission_overrides mpo
    WHERE mpo.member_id = v_member.id 
      AND mpo.is_granted = false
      AND (mpo.expires_at IS NULL OR mpo.expires_at > NOW())
  ) perms;
  
  RETURN json_build_object(
    'member_id', v_member.id,
    'role', v_member.role_key,
    'display_name', v_member.display_name,
    'title', v_member.title,
    'is_active', v_member.is_active,
    'is_member', true,
    'permissions', COALESCE(v_permissions, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ===========================================
-- INVITE MEMBER TO ORGANIZATION
-- ===========================================
CREATE OR REPLACE FUNCTION invite_organization_member(
  p_tenant_id UUID,
  p_inviter_id UUID,
  p_email TEXT,
  p_role_key TEXT,
  p_message TEXT DEFAULT NULL,
  p_resource_scopes JSONB DEFAULT '[]',
  p_custom_permissions JSONB DEFAULT '[]'
)
RETURNS JSON AS $$
DECLARE
  v_invitation_id UUID;
  v_token TEXT;
BEGIN
  -- Check inviter has permission
  IF NOT has_permission(p_inviter_id, p_tenant_id, 'team.invite') THEN
    RETURN json_build_object('success', false, 'error', 'You do not have permission to invite members');
  END IF;
  
  -- Check if already a member
  PERFORM 1 FROM organization_members om
  JOIN auth.users u ON u.id = om.user_id
  WHERE om.tenant_id = p_tenant_id AND u.email = p_email AND om.is_active = true;
  
  IF FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User is already a member of this organization');
  END IF;
  
  -- Check for pending invitation
  PERFORM 1 FROM organization_invitations
  WHERE tenant_id = p_tenant_id AND email = p_email AND status = 'pending' AND expires_at > NOW();
  
  IF FOUND THEN
    RETURN json_build_object('success', false, 'error', 'An invitation is already pending for this email');
  END IF;
  
  -- Create invitation
  INSERT INTO organization_invitations (
    tenant_id, email, role_key, invited_by, message, resource_scopes, custom_permissions
  ) VALUES (
    p_tenant_id, LOWER(p_email), p_role_key, p_inviter_id, p_message, p_resource_scopes, p_custom_permissions
  )
  RETURNING id, token INTO v_invitation_id, v_token;
  
  -- Audit log
  INSERT INTO access_audit_log (tenant_id, actor_id, action, new_value)
  VALUES (p_tenant_id, p_inviter_id, 'invitation_created', 
    jsonb_build_object('email', p_email, 'role', p_role_key, 'invitation_id', v_invitation_id));
  
  RETURN json_build_object(
    'success', true,
    'invitation_id', v_invitation_id,
    'token', v_token,
    'email', p_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- ACCEPT INVITATION
-- ===========================================
CREATE OR REPLACE FUNCTION accept_invitation(
  p_token TEXT,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_invitation RECORD;
  v_member_id UUID;
  v_scope JSONB;
BEGIN
  -- Get invitation
  SELECT * INTO v_invitation
  FROM organization_invitations
  WHERE token = p_token AND status = 'pending' AND expires_at > NOW()
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;
  
  -- Verify email matches
  PERFORM 1 FROM auth.users
  WHERE id = p_user_id AND email = v_invitation.email;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invitation email does not match your account');
  END IF;
  
  -- Create member
  INSERT INTO organization_members (
    tenant_id, user_id, role_key, invited_by, accepted_at
  ) VALUES (
    v_invitation.tenant_id, p_user_id, v_invitation.role_key, v_invitation.invited_by, NOW()
  )
  RETURNING id INTO v_member_id;
  
  -- Apply resource scopes
  FOR v_scope IN SELECT * FROM jsonb_array_elements(v_invitation.resource_scopes)
  LOOP
    INSERT INTO member_resource_scopes (member_id, resource_type, resource_id, granted_by)
    VALUES (
      v_member_id,
      v_scope->>'resource_type',
      (v_scope->>'resource_id')::uuid,
      v_invitation.invited_by
    );
  END LOOP;
  
  -- Apply custom permissions
  FOR v_scope IN SELECT * FROM jsonb_array_elements(v_invitation.custom_permissions)
  LOOP
    INSERT INTO member_permission_overrides (member_id, permission_key, is_granted, granted_by)
    VALUES (
      v_member_id,
      v_scope->>'permission_key',
      (v_scope->>'is_granted')::boolean,
      v_invitation.invited_by
    );
  END LOOP;
  
  -- Update invitation
  UPDATE organization_invitations
  SET status = 'accepted', accepted_by = p_user_id, accepted_at = NOW()
  WHERE id = v_invitation.id;
  
  -- Audit log
  INSERT INTO access_audit_log (tenant_id, actor_id, target_user_id, action, new_value)
  VALUES (v_invitation.tenant_id, p_user_id, p_user_id, 'invitation_accepted',
    jsonb_build_object('role', v_invitation.role_key, 'member_id', v_member_id));
  
  RETURN json_build_object(
    'success', true,
    'member_id', v_member_id,
    'tenant_id', v_invitation.tenant_id,
    'role', v_invitation.role_key
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- REQUEST ACCESS
-- ===========================================
CREATE OR REPLACE FUNCTION request_access(
  p_tenant_id UUID,
  p_user_id UUID,
  p_requested_role TEXT,
  p_entity_type TEXT DEFAULT 'individual',
  p_entity_name TEXT DEFAULT NULL,
  p_message TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_request_id UUID;
  v_user_email TEXT;
  v_user_name TEXT;
BEGIN
  -- Get user info
  SELECT email, raw_user_meta_data->>'full_name' INTO v_user_email, v_user_name
  FROM auth.users WHERE id = p_user_id;
  
  -- Check if already a member
  PERFORM 1 FROM organization_members
  WHERE tenant_id = p_tenant_id AND user_id = p_user_id AND is_active = true;
  
  IF FOUND THEN
    RETURN json_build_object('success', false, 'error', 'You are already a member of this organization');
  END IF;
  
  -- Check for pending request
  PERFORM 1 FROM access_requests
  WHERE tenant_id = p_tenant_id AND requester_user_id = p_user_id AND status = 'pending';
  
  IF FOUND THEN
    RETURN json_build_object('success', false, 'error', 'You already have a pending access request');
  END IF;
  
  -- Create request
  INSERT INTO access_requests (
    tenant_id, requester_user_id, requester_email, requester_name,
    requested_role, entity_type, entity_name, message
  ) VALUES (
    p_tenant_id, p_user_id, v_user_email, COALESCE(v_user_name, 'Unknown'),
    p_requested_role, p_entity_type, p_entity_name, p_message
  )
  RETURNING id INTO v_request_id;
  
  RETURN json_build_object(
    'success', true,
    'request_id', v_request_id,
    'status', 'pending'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- APPROVE ACCESS REQUEST
-- ===========================================
CREATE OR REPLACE FUNCTION approve_access_request(
  p_request_id UUID,
  p_reviewer_id UUID,
  p_role_key TEXT DEFAULT NULL,
  p_resource_scopes JSONB DEFAULT '[]',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_request RECORD;
  v_member_id UUID;
  v_final_role TEXT;
  v_scope JSONB;
BEGIN
  -- Get request
  SELECT * INTO v_request
  FROM access_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found or already processed');
  END IF;
  
  -- Check reviewer has permission
  IF NOT has_permission(p_reviewer_id, v_request.tenant_id, 'team.requests') THEN
    RETURN json_build_object('success', false, 'error', 'You do not have permission to approve requests');
  END IF;
  
  v_final_role := COALESCE(p_role_key, v_request.requested_role);
  
  -- Create member
  INSERT INTO organization_members (
    tenant_id, user_id, role_key, invited_by, accepted_at
  ) VALUES (
    v_request.tenant_id, v_request.requester_user_id, v_final_role, p_reviewer_id, NOW()
  )
  RETURNING id INTO v_member_id;
  
  -- Apply resource scopes
  FOR v_scope IN SELECT * FROM jsonb_array_elements(p_resource_scopes)
  LOOP
    INSERT INTO member_resource_scopes (member_id, resource_type, resource_id, granted_by)
    VALUES (
      v_member_id,
      v_scope->>'resource_type',
      (v_scope->>'resource_id')::uuid,
      p_reviewer_id
    );
  END LOOP;
  
  -- Update request
  UPDATE access_requests
  SET status = 'approved', reviewed_by = p_reviewer_id, reviewed_at = NOW(), review_notes = p_notes
  WHERE id = p_request_id;
  
  -- Audit log
  INSERT INTO access_audit_log (tenant_id, actor_id, target_user_id, action, new_value)
  VALUES (v_request.tenant_id, p_reviewer_id, v_request.requester_user_id, 'request_approved',
    jsonb_build_object('role', v_final_role, 'member_id', v_member_id, 'request_id', p_request_id));
  
  RETURN json_build_object(
    'success', true,
    'member_id', v_member_id,
    'role', v_final_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- DENY ACCESS REQUEST
-- ===========================================
CREATE OR REPLACE FUNCTION deny_access_request(
  p_request_id UUID,
  p_reviewer_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_request RECORD;
BEGIN
  SELECT * INTO v_request
  FROM access_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found or already processed');
  END IF;
  
  IF NOT has_permission(p_reviewer_id, v_request.tenant_id, 'team.requests') THEN
    RETURN json_build_object('success', false, 'error', 'You do not have permission to deny requests');
  END IF;
  
  UPDATE access_requests
  SET status = 'denied', reviewed_by = p_reviewer_id, reviewed_at = NOW(), review_notes = p_notes
  WHERE id = p_request_id;
  
  INSERT INTO access_audit_log (tenant_id, actor_id, target_user_id, action, new_value)
  VALUES (v_request.tenant_id, p_reviewer_id, v_request.requester_user_id, 'request_denied',
    jsonb_build_object('request_id', p_request_id, 'reason', p_notes));
  
  RETURN json_build_object('success', true, 'status', 'denied');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- UPDATE MEMBER ROLE
-- ===========================================
CREATE OR REPLACE FUNCTION update_member_role(
  p_member_id UUID,
  p_new_role TEXT,
  p_updater_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_member RECORD;
  v_old_role TEXT;
BEGIN
  SELECT * INTO v_member
  FROM organization_members WHERE id = p_member_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Member not found');
  END IF;
  
  IF NOT has_permission(p_updater_id, v_member.tenant_id, 'team.manage') THEN
    RETURN json_build_object('success', false, 'error', 'You do not have permission to manage team members');
  END IF;
  
  -- Cannot demote owner unless you're also owner
  IF v_member.role_key = 'owner' THEN
    PERFORM 1 FROM organization_members
    WHERE tenant_id = v_member.tenant_id AND user_id = p_updater_id AND role_key = 'owner';
    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'Only owners can change owner roles');
    END IF;
  END IF;
  
  v_old_role := v_member.role_key;
  
  UPDATE organization_members
  SET role_key = p_new_role, updated_at = NOW()
  WHERE id = p_member_id;
  
  INSERT INTO access_audit_log (tenant_id, actor_id, target_user_id, action, old_value, new_value)
  VALUES (v_member.tenant_id, p_updater_id, v_member.user_id, 'role_changed',
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', p_new_role));
  
  RETURN json_build_object('success', true, 'old_role', v_old_role, 'new_role', p_new_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- GRANT/REVOKE CUSTOM PERMISSION
-- ===========================================
CREATE OR REPLACE FUNCTION set_member_permission(
  p_member_id UUID,
  p_permission_key TEXT,
  p_is_granted BOOLEAN,
  p_granter_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_member RECORD;
BEGIN
  SELECT * INTO v_member FROM organization_members WHERE id = p_member_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Member not found');
  END IF;
  
  IF NOT has_permission(p_granter_id, v_member.tenant_id, 'team.manage') THEN
    RETURN json_build_object('success', false, 'error', 'You do not have permission to manage permissions');
  END IF;
  
  -- Check if granter has the permission they're trying to grant
  IF p_is_granted AND NOT has_permission(p_granter_id, v_member.tenant_id, p_permission_key) THEN
    RETURN json_build_object('success', false, 'error', 'You cannot grant a permission you do not have');
  END IF;
  
  INSERT INTO member_permission_overrides (member_id, permission_key, is_granted, granted_by, reason, expires_at)
  VALUES (p_member_id, p_permission_key, p_is_granted, p_granter_id, p_reason, p_expires_at)
  ON CONFLICT (member_id, permission_key) 
  DO UPDATE SET is_granted = p_is_granted, granted_by = p_granter_id, reason = p_reason, expires_at = p_expires_at;
  
  INSERT INTO access_audit_log (tenant_id, actor_id, target_user_id, action, new_value)
  VALUES (v_member.tenant_id, p_granter_id, v_member.user_id, 
    CASE WHEN p_is_granted THEN 'permission_granted' ELSE 'permission_revoked' END,
    jsonb_build_object('permission', p_permission_key, 'reason', p_reason));
  
  RETURN json_build_object('success', true, 'permission', p_permission_key, 'is_granted', p_is_granted);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- GET ORGANIZATION MEMBERS
-- ===========================================
CREATE OR REPLACE FUNCTION get_organization_members(p_tenant_id UUID)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_agg(
      json_build_object(
        'id', om.id,
        'user_id', om.user_id,
        'email', u.email,
        'name', COALESCE(om.display_name, u.raw_user_meta_data->>'full_name'),
        'avatar_url', u.raw_user_meta_data->>'avatar_url',
        'role_key', om.role_key,
        'role_name', ort.name,
        'role_color', ort.color,
        'title', om.title,
        'department', om.department,
        'is_active', om.is_active,
        'invited_at', om.invited_at,
        'accepted_at', om.accepted_at,
        'last_active_at', om.last_active_at
      ) ORDER BY ort.sort_order, om.accepted_at
    )
    FROM organization_members om
    JOIN auth.users u ON u.id = om.user_id
    JOIN organization_role_templates ort ON ort.key = om.role_key
    WHERE om.tenant_id = p_tenant_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- GET PENDING ACCESS REQUESTS
-- ===========================================
CREATE OR REPLACE FUNCTION get_pending_access_requests(p_tenant_id UUID)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_agg(
      json_build_object(
        'id', ar.id,
        'requester_email', ar.requester_email,
        'requester_name', ar.requester_name,
        'requested_role', ar.requested_role,
        'role_name', ort.name,
        'entity_type', ar.entity_type,
        'entity_name', ar.entity_name,
        'message', ar.message,
        'created_at', ar.created_at,
        'expires_at', ar.expires_at
      ) ORDER BY ar.created_at
    )
    FROM access_requests ar
    JOIN organization_role_templates ort ON ort.key = ar.requested_role
    WHERE ar.tenant_id = p_tenant_id AND ar.status = 'pending' AND ar.expires_at > NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- GRANTS
-- ===========================================
GRANT EXECUTE ON FUNCTION has_permission(UUID, UUID, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_permissions(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION invite_organization_member(UUID, UUID, TEXT, TEXT, TEXT, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_invitation(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION request_access(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_access_request(UUID, UUID, TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION deny_access_request(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_member_role(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_member_permission(UUID, TEXT, BOOLEAN, UUID, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_organization_members(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_access_requests(UUID) TO authenticated;
