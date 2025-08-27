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
        fields = '__all__'

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
        
        # [수정] 관련 항목이 존재하지 않을 경우를 대비하여 try-except 블록을 추가합니다.
        try:
            if reservation_id:
                validated_data['reservation'] = Reservation.objects.get(pk=reservation_id)
            if partner_id:
                validated_data['partner'] = Partner.objects.get(pk=partner_id)
        except (Reservation.DoesNotExist, Partner.DoesNotExist):
            # 관련 항목을 찾지 못하면, validation error를 발생시켜 사용자에게 알립니다.
            raise serializers.ValidationError("선택한 관련 예약 또는 제휴업체가 존재하지 않습니다.")

        transaction = Transaction.objects.create(**validated_data)
        return transaction
