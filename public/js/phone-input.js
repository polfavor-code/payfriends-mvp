/**
 * PayFriends Custom Phone Input Component
 * A clean, dark-themed phone number input with country selection
 *
 * Phone validation uses libphonenumber-js for country-specific validation rules.
 * Both the Profile page and Wizard Step 1 share this component and its validation logic.
 */

const COUNTRIES = [
  // Europe
  { name: 'Andorra', code: 'AD', dialCode: '+376', flag: '🇦🇩' },
  { name: 'Albania', code: 'AL', dialCode: '+355', flag: '🇦🇱' },
  { name: 'Austria', code: 'AT', dialCode: '+43', flag: '🇦🇹' },
  { name: 'Belgium', code: 'BE', dialCode: '+32', flag: '🇧🇪' },
  { name: 'Bulgaria', code: 'BG', dialCode: '+359', flag: '🇧🇬' },
  { name: 'Belarus', code: 'BY', dialCode: '+375', flag: '🇧🇾' },
  { name: 'Switzerland', code: 'CH', dialCode: '+41', flag: '🇨🇭' },
  { name: 'Cyprus', code: 'CY', dialCode: '+357', flag: '🇨🇾' },
  { name: 'Czech Republic', code: 'CZ', dialCode: '+420', flag: '🇨🇿' },
  { name: 'Germany', code: 'DE', dialCode: '+49', flag: '🇩🇪' },
  { name: 'Denmark', code: 'DK', dialCode: '+45', flag: '🇩🇰' },
  { name: 'Estonia', code: 'EE', dialCode: '+372', flag: '🇪🇪' },
  { name: 'Spain', code: 'ES', dialCode: '+34', flag: '🇪🇸' },
  { name: 'Finland', code: 'FI', dialCode: '+358', flag: '🇫🇮' },
  { name: 'France', code: 'FR', dialCode: '+33', flag: '🇫🇷' },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44', flag: '🇬🇧' },
  { name: 'Greece', code: 'GR', dialCode: '+30', flag: '🇬🇷' },
  { name: 'Croatia', code: 'HR', dialCode: '+385', flag: '🇭🇷' },
  { name: 'Hungary', code: 'HU', dialCode: '+36', flag: '🇭🇺' },
  { name: 'Ireland', code: 'IE', dialCode: '+353', flag: '🇮🇪' },
  { name: 'Iceland', code: 'IS', dialCode: '+354', flag: '🇮🇸' },
  { name: 'Italy', code: 'IT', dialCode: '+39', flag: '🇮🇹' },
  { name: 'Liechtenstein', code: 'LI', dialCode: '+423', flag: '🇱🇮' },
  { name: 'Lithuania', code: 'LT', dialCode: '+370', flag: '🇱🇹' },
  { name: 'Luxembourg', code: 'LU', dialCode: '+352', flag: '🇱🇺' },
  { name: 'Latvia', code: 'LV', dialCode: '+371', flag: '🇱🇻' },
  { name: 'Monaco', code: 'MC', dialCode: '+377', flag: '🇲🇨' },
  { name: 'Moldova', code: 'MD', dialCode: '+373', flag: '🇲🇩' },
  { name: 'Montenegro', code: 'ME', dialCode: '+382', flag: '🇲🇪' },
  { name: 'North Macedonia', code: 'MK', dialCode: '+389', flag: '🇲🇰' },
  { name: 'Malta', code: 'MT', dialCode: '+356', flag: '🇲🇹' },
  { name: 'Netherlands', code: 'NL', dialCode: '+31', flag: '🇳🇱' },
  { name: 'Norway', code: 'NO', dialCode: '+47', flag: '🇳🇴' },
  { name: 'Poland', code: 'PL', dialCode: '+48', flag: '🇵🇱' },
  { name: 'Portugal', code: 'PT', dialCode: '+351', flag: '🇵🇹' },
  { name: 'Romania', code: 'RO', dialCode: '+40', flag: '🇷🇴' },
  { name: 'Serbia', code: 'RS', dialCode: '+381', flag: '🇷🇸' },
  { name: 'Russia', code: 'RU', dialCode: '+7', flag: '🇷🇺' },
  { name: 'Sweden', code: 'SE', dialCode: '+46', flag: '🇸🇪' },
  { name: 'Slovenia', code: 'SI', dialCode: '+386', flag: '🇸🇮' },
  { name: 'Slovakia', code: 'SK', dialCode: '+421', flag: '🇸🇰' },
  { name: 'San Marino', code: 'SM', dialCode: '+378', flag: '🇸🇲' },
  { name: 'Turkey', code: 'TR', dialCode: '+90', flag: '🇹🇷' },
  { name: 'Ukraine', code: 'UA', dialCode: '+380', flag: '🇺🇦' },
  { name: 'Vatican City', code: 'VA', dialCode: '+379', flag: '🇻🇦' },

  // Americas
  { name: 'United States', code: 'US', dialCode: '+1', flag: '🇺🇸' },
  { name: 'Canada', code: 'CA', dialCode: '+1', flag: '🇨🇦' },
  { name: 'Argentina', code: 'AR', dialCode: '+54', flag: '🇦🇷' },
  { name: 'Bolivia', code: 'BO', dialCode: '+591', flag: '🇧🇴' },
  { name: 'Brazil', code: 'BR', dialCode: '+55', flag: '🇧🇷' },
  { name: 'Chile', code: 'CL', dialCode: '+56', flag: '🇨🇱' },
  { name: 'Colombia', code: 'CO', dialCode: '+57', flag: '🇨🇴' },
  { name: 'Costa Rica', code: 'CR', dialCode: '+506', flag: '🇨🇷' },
  { name: 'Cuba', code: 'CU', dialCode: '+53', flag: '🇨🇺' },
  { name: 'Dominican Republic', code: 'DO', dialCode: '+1', flag: '🇩🇴' },
  { name: 'Ecuador', code: 'EC', dialCode: '+593', flag: '🇪🇨' },
  { name: 'Guatemala', code: 'GT', dialCode: '+502', flag: '🇬🇹' },
  { name: 'Honduras', code: 'HN', dialCode: '+504', flag: '🇭🇳' },
  { name: 'Jamaica', code: 'JM', dialCode: '+1', flag: '🇯🇲' },
  { name: 'Mexico', code: 'MX', dialCode: '+52', flag: '🇲🇽' },
  { name: 'Nicaragua', code: 'NI', dialCode: '+505', flag: '🇳🇮' },
  { name: 'Panama', code: 'PA', dialCode: '+507', flag: '🇵🇦' },
  { name: 'Peru', code: 'PE', dialCode: '+51', flag: '🇵🇪' },
  { name: 'Paraguay', code: 'PY', dialCode: '+595', flag: '🇵🇾' },
  { name: 'El Salvador', code: 'SV', dialCode: '+503', flag: '🇸🇻' },
  { name: 'Uruguay', code: 'UY', dialCode: '+598', flag: '🇺🇾' },
  { name: 'Venezuela', code: 'VE', dialCode: '+58', flag: '🇻🇪' },

  // Asia
  { name: 'United Arab Emirates', code: 'AE', dialCode: '+971', flag: '🇦🇪' },
  { name: 'Afghanistan', code: 'AF', dialCode: '+93', flag: '🇦🇫' },
  { name: 'Armenia', code: 'AM', dialCode: '+374', flag: '🇦🇲' },
  { name: 'Azerbaijan', code: 'AZ', dialCode: '+994', flag: '🇦🇿' },
  { name: 'Bangladesh', code: 'BD', dialCode: '+880', flag: '🇧🇩' },
  { name: 'Bahrain', code: 'BH', dialCode: '+973', flag: '🇧🇭' },
  { name: 'Brunei', code: 'BN', dialCode: '+673', flag: '🇧🇳' },
  { name: 'Bhutan', code: 'BT', dialCode: '+975', flag: '🇧🇹' },
  { name: 'China', code: 'CN', dialCode: '+86', flag: '🇨🇳' },
  { name: 'Georgia', code: 'GE', dialCode: '+995', flag: '🇬🇪' },
  { name: 'Hong Kong', code: 'HK', dialCode: '+852', flag: '🇭🇰' },
  { name: 'Indonesia', code: 'ID', dialCode: '+62', flag: '🇮🇩' },
  { name: 'Israel', code: 'IL', dialCode: '+972', flag: '🇮🇱' },
  { name: 'India', code: 'IN', dialCode: '+91', flag: '🇮🇳' },
  { name: 'Iraq', code: 'IQ', dialCode: '+964', flag: '🇮🇶' },
  { name: 'Iran', code: 'IR', dialCode: '+98', flag: '🇮🇷' },
  { name: 'Jordan', code: 'JO', dialCode: '+962', flag: '🇯🇴' },
  { name: 'Japan', code: 'JP', dialCode: '+81', flag: '🇯🇵' },
  { name: 'Kazakhstan', code: 'KZ', dialCode: '+7', flag: '🇰🇿' },
  { name: 'South Korea', code: 'KR', dialCode: '+82', flag: '🇰🇷' },
  { name: 'Kuwait', code: 'KW', dialCode: '+965', flag: '🇰🇼' },
  { name: 'Kyrgyzstan', code: 'KG', dialCode: '+996', flag: '🇰🇬' },
  { name: 'Laos', code: 'LA', dialCode: '+856', flag: '🇱🇦' },
  { name: 'Lebanon', code: 'LB', dialCode: '+961', flag: '🇱🇧' },
  { name: 'Sri Lanka', code: 'LK', dialCode: '+94', flag: '🇱🇰' },
  { name: 'Myanmar', code: 'MM', dialCode: '+95', flag: '🇲🇲' },
  { name: 'Mongolia', code: 'MN', dialCode: '+976', flag: '🇲🇳' },
  { name: 'Macau', code: 'MO', dialCode: '+853', flag: '🇲🇴' },
  { name: 'Maldives', code: 'MV', dialCode: '+960', flag: '🇲🇻' },
  { name: 'Malaysia', code: 'MY', dialCode: '+60', flag: '🇲🇾' },
  { name: 'Nepal', code: 'NP', dialCode: '+977', flag: '🇳🇵' },
  { name: 'Oman', code: 'OM', dialCode: '+968', flag: '🇴🇲' },
  { name: 'Philippines', code: 'PH', dialCode: '+63', flag: '🇵🇭' },
  { name: 'Pakistan', code: 'PK', dialCode: '+92', flag: '🇵🇰' },
  { name: 'Palestine', code: 'PS', dialCode: '+970', flag: '🇵🇸' },
  { name: 'Qatar', code: 'QA', dialCode: '+974', flag: '🇶🇦' },
  { name: 'Saudi Arabia', code: 'SA', dialCode: '+966', flag: '🇸🇦' },
  { name: 'Singapore', code: 'SG', dialCode: '+65', flag: '🇸🇬' },
  { name: 'Syria', code: 'SY', dialCode: '+963', flag: '🇸🇾' },
  { name: 'Thailand', code: 'TH', dialCode: '+66', flag: '🇹🇭' },
  { name: 'Tajikistan', code: 'TJ', dialCode: '+992', flag: '🇹🇯' },
  { name: 'Turkmenistan', code: 'TM', dialCode: '+993', flag: '🇹🇲' },
  { name: 'Taiwan', code: 'TW', dialCode: '+886', flag: '🇹🇼' },
  { name: 'Uzbekistan', code: 'UZ', dialCode: '+998', flag: '🇺🇿' },
  { name: 'Vietnam', code: 'VN', dialCode: '+84', flag: '🇻🇳' },
  { name: 'Yemen', code: 'YE', dialCode: '+967', flag: '🇾🇪' },

  // Africa
  { name: 'South Africa', code: 'ZA', dialCode: '+27', flag: '🇿🇦' },
  { name: 'Algeria', code: 'DZ', dialCode: '+213', flag: '🇩🇿' },
  { name: 'Angola', code: 'AO', dialCode: '+244', flag: '🇦🇴' },
  { name: 'Benin', code: 'BJ', dialCode: '+229', flag: '🇧🇯' },
  { name: 'Botswana', code: 'BW', dialCode: '+267', flag: '🇧🇼' },
  { name: 'Burkina Faso', code: 'BF', dialCode: '+226', flag: '🇧🇫' },
  { name: 'Burundi', code: 'BI', dialCode: '+257', flag: '🇧🇮' },
  { name: 'Cameroon', code: 'CM', dialCode: '+237', flag: '🇨🇲' },
  { name: 'Cape Verde', code: 'CV', dialCode: '+238', flag: '🇨🇻' },
  { name: 'Central African Republic', code: 'CF', dialCode: '+236', flag: '🇨🇫' },
  { name: 'Chad', code: 'TD', dialCode: '+235', flag: '🇹🇩' },
  { name: 'Comoros', code: 'KM', dialCode: '+269', flag: '🇰🇲' },
  { name: 'Congo', code: 'CG', dialCode: '+242', flag: '🇨🇬' },
  { name: 'DR Congo', code: 'CD', dialCode: '+243', flag: '🇨🇩' },
  { name: 'Djibouti', code: 'DJ', dialCode: '+253', flag: '🇩🇯' },
  { name: 'Egypt', code: 'EG', dialCode: '+20', flag: '🇪🇬' },
  { name: 'Equatorial Guinea', code: 'GQ', dialCode: '+240', flag: '🇬🇶' },
  { name: 'Eritrea', code: 'ER', dialCode: '+291', flag: '🇪🇷' },
  { name: 'Ethiopia', code: 'ET', dialCode: '+251', flag: '🇪🇹' },
  { name: 'Gabon', code: 'GA', dialCode: '+241', flag: '🇬🇦' },
  { name: 'Gambia', code: 'GM', dialCode: '+220', flag: '🇬🇲' },
  { name: 'Ghana', code: 'GH', dialCode: '+233', flag: '🇬🇭' },
  { name: 'Guinea', code: 'GN', dialCode: '+224', flag: '🇬🇳' },
  { name: 'Guinea-Bissau', code: 'GW', dialCode: '+245', flag: '🇬🇼' },
  { name: 'Ivory Coast', code: 'CI', dialCode: '+225', flag: '🇨🇮' },
  { name: 'Kenya', code: 'KE', dialCode: '+254', flag: '🇰🇪' },
  { name: 'Lesotho', code: 'LS', dialCode: '+266', flag: '🇱🇸' },
  { name: 'Liberia', code: 'LR', dialCode: '+231', flag: '🇱🇷' },
  { name: 'Libya', code: 'LY', dialCode: '+218', flag: '🇱🇾' },
  { name: 'Madagascar', code: 'MG', dialCode: '+261', flag: '🇲🇬' },
  { name: 'Malawi', code: 'MW', dialCode: '+265', flag: '🇲🇼' },
  { name: 'Mali', code: 'ML', dialCode: '+223', flag: '🇲🇱' },
  { name: 'Mauritania', code: 'MR', dialCode: '+222', flag: '🇲🇷' },
  { name: 'Mauritius', code: 'MU', dialCode: '+230', flag: '🇲🇺' },
  { name: 'Morocco', code: 'MA', dialCode: '+212', flag: '🇲🇦' },
  { name: 'Mozambique', code: 'MZ', dialCode: '+258', flag: '🇲🇿' },
  { name: 'Namibia', code: 'NA', dialCode: '+264', flag: '🇳🇦' },
  { name: 'Niger', code: 'NE', dialCode: '+227', flag: '🇳🇪' },
  { name: 'Nigeria', code: 'NG', dialCode: '+234', flag: '🇳🇬' },
  { name: 'Rwanda', code: 'RW', dialCode: '+250', flag: '🇷🇼' },
  { name: 'Sao Tome and Principe', code: 'ST', dialCode: '+239', flag: '🇸🇹' },
  { name: 'Senegal', code: 'SN', dialCode: '+221', flag: '🇸🇳' },
  { name: 'Seychelles', code: 'SC', dialCode: '+248', flag: '🇸🇨' },
  { name: 'Sierra Leone', code: 'SL', dialCode: '+232', flag: '🇸🇱' },
  { name: 'Somalia', code: 'SO', dialCode: '+252', flag: '🇸🇴' },
  { name: 'South Sudan', code: 'SS', dialCode: '+211', flag: '🇸🇸' },
  { name: 'Sudan', code: 'SD', dialCode: '+249', flag: '🇸🇩' },
  { name: 'Eswatini', code: 'SZ', dialCode: '+268', flag: '🇸🇿' },
  { name: 'Tanzania', code: 'TZ', dialCode: '+255', flag: '🇹🇿' },
  { name: 'Togo', code: 'TG', dialCode: '+228', flag: '🇹🇬' },
  { name: 'Tunisia', code: 'TN', dialCode: '+216', flag: '🇹🇳' },
  { name: 'Uganda', code: 'UG', dialCode: '+256', flag: '🇺🇬' },
  { name: 'Zambia', code: 'ZM', dialCode: '+260', flag: '🇿🇲' },
  { name: 'Zimbabwe', code: 'ZW', dialCode: '+263', flag: '🇿🇼' },

  // Oceania
  { name: 'Australia', code: 'AU', dialCode: '+61', flag: '🇦🇺' },
  { name: 'New Zealand', code: 'NZ', dialCode: '+64', flag: '🇳🇿' },
  { name: 'Fiji', code: 'FJ', dialCode: '+679', flag: '🇫🇯' },
  { name: 'Papua New Guinea', code: 'PG', dialCode: '+675', flag: '🇵🇬' },
  { name: 'Samoa', code: 'WS', dialCode: '+685', flag: '🇼🇸' },
  { name: 'Solomon Islands', code: 'SB', dialCode: '+677', flag: '🇸🇧' },
  { name: 'Tonga', code: 'TO', dialCode: '+676', flag: '🇹🇴' },
  { name: 'Vanuatu', code: 'VU', dialCode: '+678', flag: '🇻🇺' },

  // Additional territories and special cases
  { name: 'Puerto Rico', code: 'PR', dialCode: '+1', flag: '🇵🇷' },
  { name: 'Bahamas', code: 'BS', dialCode: '+1', flag: '🇧🇸' },
  { name: 'Barbados', code: 'BB', dialCode: '+1', flag: '🇧🇧' },
  { name: 'Trinidad and Tobago', code: 'TT', dialCode: '+1', flag: '🇹🇹' },
  { name: 'Greenland', code: 'GL', dialCode: '+299', flag: '🇬🇱' },
  { name: 'Faroe Islands', code: 'FO', dialCode: '+298', flag: '🇫🇴' },
  { name: 'North Korea', code: 'KP', dialCode: '+850', flag: '🇰🇵' },
  { name: 'Cambodia', code: 'KH', dialCode: '+855', flag: '🇰🇭' },
  { name: 'Timor-Leste', code: 'TL', dialCode: '+670', flag: '🇹🇱' },
];

class PhoneInput {
  constructor(container) {
    this.container = container;
    this.selectedCountry = COUNTRIES[0]; // Default to Netherlands
    this.elements = {};
    this.isDropdownOpen = false;

    this.init();
  }

  init() {
    // Find or create elements
    this.elements.countryButton = this.container.querySelector('.phone-country-button');
    this.elements.prefix = this.container.querySelector('.phone-prefix');
    this.elements.localInput = this.container.querySelector('.phone-number-input');
    this.elements.fullInput = this.container.querySelector('.phone-number-full');
    this.elements.dropdown = this.container.querySelector('.phone-dropdown');
    this.elements.searchInput = this.container.querySelector('.phone-dropdown-search');
    this.elements.countryList = this.container.querySelector('.phone-country-list');

    // Set up event listeners
    this.setupEventListeners();

    // Initialize with default country
    this.updateCountryDisplay();

    // Parse existing value if present
    const initialValue = this.elements.fullInput.value;
    if (initialValue) {
      this.setNumber(initialValue);
    }
  }

  setupEventListeners() {
    // Country button click - toggle dropdown
    this.elements.countryButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleDropdown();
    });

    // Search input
    this.elements.searchInput.addEventListener('input', (e) => {
      this.filterCountries(e.target.value);
    });

    // Local number input - validate on every keystroke
    this.elements.localInput.addEventListener('input', (e) => {
      this.handleLocalInput(e);
    });

    // Blur event - show validation error when user leaves the field
    this.elements.localInput.addEventListener('blur', () => {
      this._triggerValidationChange('blur');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target) && this.isDropdownOpen) {
        this.closeDropdown();
      }
    });

    // Close dropdown on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isDropdownOpen) {
        this.closeDropdown();
      }
    });

    // Render country list
    this.renderCountryList();
  }

  toggleDropdown() {
    if (this.isDropdownOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  openDropdown() {
    this.isDropdownOpen = true;
    this.elements.dropdown.style.display = 'block';
    this.elements.searchInput.value = '';
    this.elements.searchInput.focus();
    this.filterCountries('');
  }

  closeDropdown() {
    this.isDropdownOpen = false;
    this.elements.dropdown.style.display = 'none';
  }

  filterCountries(query) {
    const lowerQuery = query.toLowerCase();
    const filteredCountries = COUNTRIES.filter(country => {
      return country.name.toLowerCase().includes(lowerQuery) ||
             country.code.toLowerCase().includes(lowerQuery) ||
             country.dialCode.includes(lowerQuery);
    });

    this.renderCountryList(filteredCountries);
  }

  renderCountryList(countries = COUNTRIES) {
    this.elements.countryList.innerHTML = countries.map(country => `
      <div class="phone-country-item" data-code="${country.code}">
        <span class="phone-country-flag">${country.flag}</span>
        <span class="phone-country-name">${country.name}</span>
        <span class="phone-country-dial">${country.dialCode}</span>
      </div>
    `).join('');

    // Add click listeners to country items
    this.elements.countryList.querySelectorAll('.phone-country-item').forEach(item => {
      item.addEventListener('click', () => {
        const countryCode = item.dataset.code;
        const country = COUNTRIES.find(c => c.code === countryCode);
        if (country) {
          this.selectCountry(country);
          this.closeDropdown();
          this.elements.localInput.focus();
        }
      });
    });
  }

  selectCountry(country) {
    this.selectedCountry = country;
    this.updateCountryDisplay();
    this.updateFullNumber();

    // Revalidate with the new country (same digits may now be valid/invalid)
    this._triggerValidationChange();
  }

  updateCountryDisplay() {
    // Update button content
    this.elements.countryButton.innerHTML = `
      <span class="phone-country-flag">${this.selectedCountry.flag}</span>
      <span class="phone-country-name">${this.selectedCountry.name}</span>
      <span class="phone-caret">▼</span>
    `;

    // Update prefix
    this.elements.prefix.textContent = this.selectedCountry.dialCode;
  }

  handleLocalInput(e) {
    let value = e.target.value;

    // If user types a +, try to detect country
    if (value.startsWith('+')) {
      this.detectAndSetCountry(value);
      return;
    }

    // Strip non-digits from local input (handles pasting with spaces, dashes, etc.)
    const digitsOnly = value.replace(/\D/g, '');
    e.target.value = digitsOnly;

    this.updateFullNumber();

    // Trigger validation change callback if registered
    this._triggerValidationChange();
  }

  detectAndSetCountry(fullNumber) {
    // Try to match the dial code (allows user to type +31 to switch to Netherlands, etc.)
    const sortedCountries = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);

    for (const country of sortedCountries) {
      if (fullNumber.startsWith(country.dialCode)) {
        this.selectedCountry = country;
        this.updateCountryDisplay();

        // Extract local part
        const localPart = fullNumber.substring(country.dialCode.length).replace(/\D/g, '');
        this.elements.localInput.value = localPart;
        this.updateFullNumber();
        this._triggerValidationChange();
        return;
      }
    }

    // If no match, just strip non-digits
    const digitsOnly = fullNumber.replace(/\D/g, '');
    this.elements.localInput.value = digitsOnly;
    this.updateFullNumber();
    this._triggerValidationChange();
  }

  updateFullNumber() {
    const localDigits = this.elements.localInput.value.replace(/\D/g, '');
    const fullNumber = localDigits ? `${this.selectedCountry.dialCode}${localDigits}` : '';
    this.elements.fullInput.value = fullNumber;
  }

  // Public API methods
  setNumber(e164Number) {
    if (!e164Number || !e164Number.startsWith('+')) {
      return;
    }

    // Try to detect country from dial code
    const sortedCountries = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);

    for (const country of sortedCountries) {
      if (e164Number.startsWith(country.dialCode)) {
        this.selectedCountry = country;
        this.updateCountryDisplay();

        // Extract local part
        const localPart = e164Number.substring(country.dialCode.length).replace(/\D/g, '');
        this.elements.localInput.value = localPart;
        this.updateFullNumber();
        return;
      }
    }
  }

  getNumber() {
    return this.elements.fullInput.value;
  }

  /**
   * Validates the phone number using country-specific rules from libphonenumber-js.
   * This is the single source of truth for phone validation across the app.
   * @returns {boolean} true if the phone number is valid for the selected country
   */
  isValidNumber() {
    const number = this.getNumber();
    const countryCode = this.selectedCountry.code;

    // Empty number is not valid
    if (!number || number === this.selectedCountry.dialCode) {
      return false;
    }

    // Use libphonenumber-js if available for country-specific validation
    if (typeof libphonenumber !== 'undefined') {
      try {
        const phoneNumber = libphonenumber.parsePhoneNumberFromString(number, countryCode);
        if (phoneNumber) {
          return phoneNumber.isValid();
        }
        return false;
      } catch (e) {
        console.warn('Phone validation error:', e);
        return false;
      }
    }

    // Fallback: basic validation if library not loaded
    return number.startsWith('+') && number.length > this.selectedCountry.dialCode.length;
  }

  /**
   * Returns a validation error message for the current phone number.
   * Uses the country name dynamically to provide clear feedback.
   * @returns {string|null} Error message if invalid, null if valid
   */
  getValidationError() {
    const number = this.getNumber();
    const countryCode = this.selectedCountry.code;
    const countryName = this.selectedCountry.name;

    // Empty number
    if (!number || number === this.selectedCountry.dialCode) {
      return `Please enter a phone number for ${countryName}.`;
    }

    // Use libphonenumber-js if available
    if (typeof libphonenumber !== 'undefined') {
      try {
        const phoneNumber = libphonenumber.parsePhoneNumberFromString(number, countryCode);

        if (!phoneNumber) {
          return `Please enter a valid phone number for ${countryName}.`;
        }

        if (!phoneNumber.isValid()) {
          // Check if it's a length issue
          if (!phoneNumber.isPossible()) {
            const nationalNumber = this.elements.localInput.value.replace(/\D/g, '');
            // Try to give more specific feedback
            return `Please enter a valid phone number for ${countryName}. Check the number of digits.`;
          }
          return `Please enter a valid phone number for ${countryName}.`;
        }

        return null; // Valid
      } catch (e) {
        return `Please enter a valid phone number for ${countryName}.`;
      }
    }

    // Fallback validation
    if (!number.startsWith('+') || number.length <= this.selectedCountry.dialCode.length) {
      return `Please enter a valid phone number for ${countryName}.`;
    }

    return null;
  }

  /**
   * Returns the selected country's code (e.g., 'NL', 'AD', 'US')
   * @returns {string} ISO 3166-1 alpha-2 country code
   */
  getCountryCode() {
    return this.selectedCountry.code;
  }

  /**
   * Returns the selected country's name
   * @returns {string} Country name
   */
  getCountryName() {
    return this.selectedCountry.name;
  }

  /**
   * Returns a friendly typing hint showing digit progress.
   * Used to provide positive feedback while user is typing.
   * @returns {{ text: string, isValid: boolean, isTooLong: boolean, currentDigits: number, expectedDigits: number|null }}
   */
  getTypingHint() {
    const currentDigits = this.elements.localInput.value.replace(/\D/g, '').length;
    const countryCode = this.selectedCountry.code;
    const countryName = this.selectedCountry.name;
    const isValid = this.isValidNumber();

    // Try to get expected digit count from libphonenumber-js
    let expectedDigits = null;
    let isTooLong = false;

    if (typeof libphonenumber !== 'undefined') {
      try {
        const example = libphonenumber.getExampleNumber(countryCode);
        if (example) {
          expectedDigits = example.nationalNumber.length;
        }
        // Simple check: if we have more digits than the example, it's too long
        if (expectedDigits && currentDigits > expectedDigits) {
          isTooLong = true;
        }
      } catch (e) {
        // Some countries may not have examples
      }
    }

    if (isValid) {
      return {
        text: `Valid ${countryName} number`,
        isValid: true,
        isTooLong: false,
        currentDigits,
        expectedDigits
      };
    }

    return {
      text: `Please enter a valid phone number for ${countryName}. Check the number of digits.`,
      isValid: false,
      isTooLong,
      currentDigits,
      expectedDigits
    };
  }

  setInvalid(invalid) {
    if (invalid) {
      this.elements.localInput.classList.add('phone-input-invalid');
    } else {
      this.elements.localInput.classList.remove('phone-input-invalid');
    }
  }

  /**
   * Registers a callback to be called when validation state changes.
   * Useful for updating error messages dynamically as the user types.
   * @param {function} callback - Called with (isValid, errorMessage, typingHint, eventType)
   * eventType is 'input' for typing or 'blur' for leaving the field
   */
  onValidationChange(callback) {
    this.validationCallback = callback;
  }

  /**
   * Triggers validation and calls the registered callback if any.
   * @param {string} eventType - 'input' for typing, 'blur' for leaving field
   * @private
   */
  _triggerValidationChange(eventType = 'input') {
    if (this.validationCallback) {
      const isValid = this.isValidNumber();
      const errorMessage = isValid ? null : this.getValidationError();
      const typingHint = this.getTypingHint();
      this.validationCallback(isValid, errorMessage, typingHint, eventType);
    }
  }
}

// Auto-initialize all phone inputs on the page
const PhoneInputManager = {
  instances: new Map(),

  initialize() {
    document.querySelectorAll('.phone-input-wrapper').forEach(container => {
      const id = container.dataset.phoneId || container.querySelector('.phone-number-full')?.id;
      if (id && !this.instances.has(id)) {
        const instance = new PhoneInput(container);
        this.instances.set(id, instance);
      }
    });
  },

  getInstance(id) {
    return this.instances.get(id);
  }
};

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    PhoneInputManager.initialize();
  });
} else {
  PhoneInputManager.initialize();
}

// Export for use in other scripts
window.PhoneInputManager = PhoneInputManager;
window.PhoneInput = PhoneInput;
