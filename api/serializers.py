from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Customer, Reservation, Partner, Transaction

class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id', 'name', 'phone_number', 'email']

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'is_superuser']

class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    class Meta:
        model = User
        fields = ['id', 'username', 'password']
    
    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password']
        )
        return user

class PartnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Partner
        fields = '__all__'

class ReservationSerializer(serializers.ModelSerializer):
    customer = CustomerSerializer(read_only=True, allow_null=True)
    manager = UserSerializer(read_only=True, allow_null=True)
    customer_id = serializers.IntegerField(write_only=True, allow_null=True, required=False)
    manager_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    class Meta:
        model = Reservation
        fields = '__all__' # 모든 필드를 포함
    
    def create(self, validated_data):
        customer_id = validated_data.pop('customer_id', None)
        customer = Customer.objects.get(pk=customer_id) if customer_id else None
        reservation = Reservation.objects.create(customer=customer, **validated_data)
        return reservation

    def update(self, instance, validated_data):
        customer_id = validated_data.pop('customer_id', None)
        if customer_id:
            instance.customer = Customer.objects.get(pk=customer_id)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

class TransactionSerializer(serializers.ModelSerializer):
    reservation = ReservationSerializer(read_only=True, allow_null=True)
    partner = PartnerSerializer(read_only=True, allow_null=True)
    manager = UserSerializer(read_only=True, allow_null=True)
    reservation_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    partner_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    manager_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Transaction
        fields = '__all__'

    def create(self, validated_data):
        reservation_id = validated_data.pop('reservation_id', None)
        partner_id = validated_data.pop('partner_id', None)
        manager_id = validated_data.pop('manager_id', None)
        
        if reservation_id:
            validated_data['reservation'] = Reservation.objects.get(pk=reservation_id)
        if partner_id:
            validated_data['partner'] = Partner.objects.get(pk=partner_id)
        if manager_id:
            validated_data['manager'] = User.objects.get(pk=manager_id)
            
        return Transaction.objects.create(**validated_data)
