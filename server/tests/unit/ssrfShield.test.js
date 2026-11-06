import { isPrivateOrRestrictedIP, validateOutboundUrl, redactSensitiveData, SSRFSecurityError } from '../../src/services/ssrfShield.js';

describe('SSRF Shield Service', () => {
  describe('isPrivateOrRestrictedIP', () => {
    it('should identify loopback addresses as restricted', () => {
      expect(isPrivateOrRestrictedIP('127.0.0.1')).toBe(true);
      expect(isPrivateOrRestrictedIP('127.0.1.5')).toBe(true);
      expect(isPrivateOrRestrictedIP('::1')).toBe(true);
    });

    it('should identify RFC 1918 private subnets as restricted', () => {
      expect(isPrivateOrRestrictedIP('10.0.0.1')).toBe(true);
      expect(isPrivateOrRestrictedIP('172.16.0.5')).toBe(true);
      expect(isPrivateOrRestrictedIP('192.168.1.1')).toBe(true);
    });

    it('should identify cloud metadata IP 169.254.169.254 as restricted', () => {
      expect(isPrivateOrRestrictedIP('169.254.169.254')).toBe(true);
    });

    it('should allow valid public IP addresses', () => {
      expect(isPrivateOrRestrictedIP('8.8.8.8')).toBe(false);
      expect(isPrivateOrRestrictedIP('1.1.1.1')).toBe(false);
      expect(isPrivateOrRestrictedIP('142.250.190.46')).toBe(false);
    });
  });

  describe('validateOutboundUrl', () => {
    it('should reject non-HTTP schemes like file:// or ftp://', async () => {
      await expect(validateOutboundUrl('file:///etc/passwd')).rejects.toThrow(SSRFSecurityError);
      await expect(validateOutboundUrl('ftp://example.com/file')).rejects.toThrow(SSRFSecurityError);
      await expect(validateOutboundUrl('gopher://127.0.0.1:70')).rejects.toThrow(SSRFSecurityError);
    });

    it('should block localhost and metadata destinations when allowLocal is false', async () => {
      await expect(validateOutboundUrl('http://localhost:8080/test', false)).rejects.toThrow(SSRFSecurityError);
      await expect(validateOutboundUrl('http://127.0.0.1:3000/api', false)).rejects.toThrow(SSRFSecurityError);
      await expect(validateOutboundUrl('http://169.254.169.254/latest/meta-data', false)).rejects.toThrow(SSRFSecurityError);
    });

    it('should permit localhost when allowLocal is explicitly enabled', async () => {
      const res = await validateOutboundUrl('http://127.0.0.1:5001/api/v1/mock/echo', true);
      expect(res.validUrl.hostname).toBe('127.0.0.1');
      expect(res.pinnedIP).toBe('127.0.0.1');
    });
  });

  describe('redactSensitiveData', () => {
    it('should mask sensitive keys like Authorization, Password, and API Keys', () => {
      const sample = {
        authorization: 'Bearer secret_jwt_token',
        password: 'mySuperSecretPassword',
        'x-api-key': 'prod_key_123',
        normalField: 'hello world',
        nested: {
          token: 'xyz',
          publicId: 42,
        },
      };

      const redacted = redactSensitiveData(sample);
      expect(redacted.authorization).toBe('[REDACTED]');
      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted['x-api-key']).toBe('[REDACTED]');
      expect(redacted.normalField).toBe('hello world');
      expect(redacted.nested.token).toBe('[REDACTED]');
      expect(redacted.nested.publicId).toBe(42);
    });
  });
});
