function closeModal(id) {
    if (document.activeElement) document.activeElement.blur();
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    function openModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.style.display = 'block';
    }

    let cart = [];
    let cartCount = 0;
    let currentStep = 0;
    let totalAmount = 0;

    const steps = ['step-basket', 'step-details', 'step-payment', 'step-confirm'];
    const progressSteps = document.querySelectorAll('.progress-bar .step');

    const checkoutModal = document.getElementById('checkout-modal');
    const cartItemsContainer = document.getElementById('checkout-cart-items');
    const checkoutTotal = document.getElementById('checkout-total');
    const confirmName = document.getElementById('confirm-name');
    const confirmEmail = document.getElementById('confirm-email');
    const confirmAddress = document.getElementById('confirm-address');
    const confirmTotal = document.getElementById('confirm-total');

    function updateCartSummary() {
        cartItemsContainer.innerHTML = '';
        totalAmount = 0;

        cart.forEach(item => {
            const li = document.createElement('li');
            const discountedPrice = item.price * 0.8;
            li.innerHTML = `<i class="fas fa-shopping-cart"></i> ${item.name} - <del>£${item.price.toFixed(2)}</del> <strong>£${discountedPrice.toFixed(2)}</strong>`;
            cartItemsContainer.appendChild(li);
            totalAmount += discountedPrice;
        });

        checkoutTotal.textContent = `£${totalAmount.toFixed(2)}`;
    }

    function updateStepDisplay() {
        if (document.activeElement) document.activeElement.blur();
        steps.forEach((id, index) => {
            const stepEl = document.getElementById(id);
            if (stepEl) stepEl.style.display = index === currentStep ? 'block' : 'none';
            if (progressSteps[index]) {
                progressSteps[index].classList.toggle('active', index <= currentStep);
            }
        });
    }

    function nextStep() {
        if (currentStep === 1) {
            const name = document.getElementById('checkout-name').value.trim();
            const email = document.getElementById('checkout-email').value.trim();
            const address1 = document.getElementById('address-line1').value.trim();
            const address2 = document.getElementById('address-line2').value.trim();
            const postcode = document.getElementById('postcode').value.trim();
            const country = document.getElementById('country').value.trim();

            if (!name || !email || !address1 || !postcode || !country) {
                alert('Please fill out all required address fields.');
                return;
            }

            if (!/\S+@\S+\.\S+/.test(email)) {
                alert('Please enter a valid email address.');
                return;
            }

            confirmName.textContent = name;
            confirmEmail.textContent = email;
            confirmAddress.textContent = `${address1}, ${address2 ? address2 + ', ' : ''}${postcode}, ${country}`;
            confirmTotal.textContent = checkoutTotal.textContent;
        }

        if (currentStep < steps.length - 1) {
            currentStep++;
            updateStepDisplay();
        }
    }

    function prevStep() {
        if (currentStep > 0) {
            currentStep--;
            updateStepDisplay();
        }
    }

    document.querySelectorAll('.add-to-cart').forEach(button => {
        button.addEventListener('click', function () {
            const name = this.getAttribute('data-product');
            const price = parseFloat(this.getAttribute('data-price'));
            cart.push({ name, price });

            cartCount++;
            const cartCountElement = document.getElementById('cart-count');
            if (cartCountElement) cartCountElement.innerText = cartCount;

            updateCartSummary();
        });
    });

    document.getElementById('cart-btn').addEventListener('click', () => {
        updateCartSummary();
        currentStep = 0;
        updateStepDisplay();
        openModal('checkout-modal');
    });

    // Stripe setup
    const stripe = Stripe('pk_live_51RHr5g00vYTXWJ1EIq9khvyn8KLs0JivRf2leeY8Nw3UJ7bmij0ZSbXIWpRDwbvY1pVflP4X939Mupeu2rmdpYBC00V5qDoHV1');
    const elements = stripe.elements();
    const cardElement = elements.create('card');
    cardElement.mount('#card-element');

    // Stripe form submission handler
    document.getElementById('checkout-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('checkout-name').value.trim();
        const email = document.getElementById('checkout-email').value.trim();
        const address1 = document.getElementById('address-line1').value.trim();
        const address2 = document.getElementById('address-line2').value.trim();
        const postcode = document.getElementById('postcode').value.trim();
        const country = document.getElementById('country').value.trim();
        const fullAddress = `${address1}, ${address2 ? address2 + ', ' : ''}${postcode}, ${country}`;

        try {
            const { token, error } = await stripe.createToken(cardElement);

            if (error) {
                alert('Payment error: ' + error.message);
                return;
            }

            const response = await fetch('http://localhost:3000/create-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: token.id,
                    name,
                    email,
                    address: fullAddress,
                    cart,
                    amount: Math.round(totalAmount * 100)

                })
            });

            const result = await response.json();

            if (result.success) {
                alert('Payment Successful! 🎉');
                cart = [];
                cartCount = 0;
                document.getElementById('cart-count').innerText = cartCount;
                updateCartSummary();

                currentStep = 3; // Show confirmation step
                updateStepDisplay();
            } else {
                alert('Payment failed: ' + result.error);
            }

        } catch (err) {
            console.error(err);
            alert('There was an error processing your payment.');
        }
    });

    // Contact Form Logic
    const contactForm = document.getElementById('contact-form');
    const contactSuccessDiv = document.getElementById('contact-success');

    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('contact-name').value.trim();
            const email = document.getElementById('contact-email').value.trim();
            const message = document.getElementById('contact-message').value.trim();

            if (!name || !email || !message) {
                alert('Please fill in all fields before submitting.');
                return;
            }

            try {
                const response = await fetch('http://localhost:3000/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, message }),
                });

                const result = await response.json();

                if (result.success) {
                    contactSuccessDiv.style.display = 'block';
                    contactSuccessDiv.textContent = 'Thank you! Your message has been sent. 💌';
                    contactForm.reset();
                } else {
                    alert('Oops, something went wrong. Please try again.');
                }
            } catch (error) {
                console.error('Error sending contact form:', error);
                alert('Server error. Please try again later.');
            }
        });
    }

    //  Step Navigation Buttons
    document.querySelectorAll('.next-step').forEach(btn => btn.addEventListener('click', nextStep));
    document.querySelectorAll('.prev-step').forEach(btn => btn.addEventListener('click', prevStep));


});
